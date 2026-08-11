import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runDirector } from "@/lib/director";
import { Storyboard } from "@/lib/storyboard";
import { readKit } from "@/lib/brand-kits";
import { readConfig } from "@/lib/config";
import { STYLES, STYLE_IDS, QUALITY_IDS } from "@/lib/storyboard";
import { profileToPrompt, readReference } from "@/lib/motion-profile";

export const runtime = "nodejs";
export const maxDuration = 300;

const STORE = join(process.cwd(), "data", "storyboards");

type BriefBody = {
  brief: string;
  duration?: number;
  tone?: string;
  ratio?: string;
  style?: string;
  quality?: string;
  referenceId?: string;
  brandKitId?: string;
};

const RATIOS = ["16:9", "1:1", "9:16"];

export async function POST(req: NextRequest) {
  let body: BriefBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const brief = body.brief?.trim();
  if (!brief || brief.length < 10) {
    return NextResponse.json({ error: "brief must be at least 10 characters" }, { status: 400 });
  }
  // ~150 wpm VO pacing caps a video at 90s ≈ 340 words. Be honest up front.
  const words = brief.split(/\s+/).filter(Boolean).length;
  if (words > 340) {
    const minutes = (words / 150).toFixed(1);
    return NextResponse.json(
      {
        error: `Script is too long: ${words} words ≈ ${minutes} minutes of narration (max 90s ≈ 340 words). Cut it down, or split it into parts — one video per part.`,
      },
      { status: 400 },
    );
  }
  if (body.duration !== undefined && (body.duration < 8 || body.duration > 90)) {
    return NextResponse.json({ error: "duration must be 8-90s" }, { status: 400 });
  }
  const ratio = body.ratio ?? "16:9";
  if (!RATIOS.includes(ratio)) {
    return NextResponse.json({ error: `ratio must be one of ${RATIOS.join(", ")}` }, { status: 400 });
  }
  const style = STYLE_IDS.includes(body.style as never) ? (body.style as (typeof STYLE_IDS)[number]) : "studio-black";
  const styleDef = STYLES[style];
  const quality = QUALITY_IDS.includes(body.quality as never) ? (body.quality as (typeof QUALITY_IDS)[number]) : "max";

  try {
    const startedAt = Date.now();
    const kit = body.brandKitId ? await readKit(body.brandKitId) : null;
    if (body.brandKitId && !kit) {
      return NextResponse.json({ error: "brand kit not found" }, { status: 404 });
    }
    const reference = body.referenceId ? await readReference(body.referenceId) : null;
    if (body.referenceId && !reference) {
      return NextResponse.json({ error: "reference not found — re-upload the video" }, { status: 404 });
    }
    // Voice-tier gate (PLAN §7) is independent of the storyboard — classify on
    // the brief in parallel with the director instead of serially after it.
    const cfg = await readConfig();
    const tierP =
      cfg.voice.enabled && cfg.voice.apiKey
        ? classifyVoiceTier(brief).catch(() => ({ tier: "AI-OK" as const, usage: { model: "n/a", prompt: 0, completion: 0, total: 0 } }))
        : Promise.resolve({ tier: undefined as string | undefined, usage: undefined as { model: string; prompt: number; completion: number; total: number } | undefined });
    const { storyboard, usage, beats } = await runDirector(brief, {
      ...body,
      ratio,
      style,
      reference: reference ? profileToPrompt(reference) : undefined,
      brandKit: kit ? { name: kit.name, colors: kit.colors, vibe: kit.vibe } : undefined,
    });
    // Style is baked deterministically into every scene's values (templates read
    // values.bg / values.textColor) — no LLM dependency for the look. A reference
    // video's extracted palette overrides the preset when present.
    const bg = reference?.palette?.[0] ?? styleDef.bg;
    const text = reference?.palette?.[1] ?? styleDef.text;
    for (const scene of storyboard.scenes) {
      scene.values.bg = bg;
      scene.values.textColor = text;
    }
    const id = `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    // Voice-tier gate (PLAN §7): classified per video — AI-OK / Hybrid / Human-only.
    const { tier: voiceTier, usage: tierUsage } = await tierP;
    const usageLog: { at: string; kind: string; model: string; prompt: number; completion: number; total: number }[] = [
      { at: new Date().toISOString(), kind: "director", ...usage },
    ];
    if (voiceTier && tierUsage) {
      usageLog.push({ at: new Date().toISOString(), kind: "voice-tier", ...tierUsage });
    }

    await mkdir(STORE, { recursive: true });
    console.log(
      `[brief] ${id} planned in ${((Date.now() - startedAt) / 1000).toFixed(0)}s — ${storyboard.scenes.length} scenes, ${storyboard.total}s, voice tier ${voiceTier ?? "none"}`,
    );
    await writeFile(
      join(STORE, `${id}.json`),
      JSON.stringify(
        {
          id,
          brief,
          ratio,
          style,
          quality,
          brandKitId: kit?.id,
          brandKitName: kit?.name,
          palette: kit?.colors,
          voiceTier,
          usage: usageLog,
          beats,
          referenceId: body.referenceId,
          reference: reference ? profileToPrompt(reference) : undefined,
          storyboard,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return NextResponse.json({ id, storyboard: storyboard as Storyboard, voiceTier, usage: usageLog, beats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "director failed" }, { status: 502 });
  }
}

const TIERS = ["AI-OK", "Hybrid", "Human-only"] as const;

/**
 * Voice-tier gate (PLAN §7): classify trust threshold & emotion load.
 * AI-OK     — data/news/technical: full AI narration acceptable.
 * Hybrid    — documentary/explainer: AI body + human hook/outro.
 * Human-only— emotion/story: engine exports voice-direction only.
 */
async function classifyVoiceTier(
  brief: string,
): Promise<{ tier: (typeof TIERS)[number]; usage: { model: string; prompt: number; completion: number; total: number } }> {
  const { chatJsonU } = await import("@/lib/zen");
  const { json: d, usage } = await chatJsonU<{ tier?: string }>(
    `You are the VOICE-TIER GATE of an agentic motion-graphics engine.
Classify the video by trust threshold & emotion load into exactly one tier:
- AI-OK: data/news/technical explainers where a clean AI voice is trusted.
- Hybrid: documentary/explainer with story elements — AI body, human hook/outro.
- Human-only: emotional, personal, or testimonial stories — never AI-narrated.
Return ONLY valid JSON: {"tier":"..."}.`,
    JSON.stringify({ brief }),
  );
  const tier = d?.tier;
  return {
    tier: TIERS.includes(tier as (typeof TIERS)[number]) ? (tier as (typeof TIERS)[number]) : "AI-OK",
    usage,
  };
}