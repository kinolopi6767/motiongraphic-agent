import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runDirector } from "@/lib/director";
import { Storyboard } from "@/lib/storyboard";
import { readKit } from "@/lib/brand-kits";
import { readConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 120;

const STORE = join(process.cwd(), "data", "storyboards");

type BriefBody = {
  brief: string;
  duration?: number;
  tone?: string;
  ratio?: string;
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
  if (body.duration !== undefined && (body.duration < 8 || body.duration > 90)) {
    return NextResponse.json({ error: "duration must be 8-90s" }, { status: 400 });
  }
  const ratio = body.ratio ?? "16:9";
  if (!RATIOS.includes(ratio)) {
    return NextResponse.json({ error: `ratio must be one of ${RATIOS.join(", ")}` }, { status: 400 });
  }

  try {
    const kit = body.brandKitId ? await readKit(body.brandKitId) : null;
    if (body.brandKitId && !kit) {
      return NextResponse.json({ error: "brand kit not found" }, { status: 404 });
    }
    const { storyboard, usage } = await runDirector(brief, {
      ...body,
      ratio,
      brandKit: kit ? { name: kit.name, colors: kit.colors, vibe: kit.vibe } : undefined,
    });
    const id = `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    // Voice-tier gate (PLAN §7): classified per video — AI-OK / Hybrid / Human-only.
    let voiceTier: string | undefined;
    const cfg = await readConfig();
    const usageLog: { at: string; kind: string; model: string; prompt: number; completion: number; total: number }[] = [
      { at: new Date().toISOString(), kind: "director", ...usage },
    ];
    if (cfg.voice.enabled && cfg.voice.apiKey) {
      try {
        const t = await classifyVoiceTier(brief, storyboard);
        voiceTier = t.tier;
        usageLog.push({ at: new Date().toISOString(), kind: "voice-tier", ...t.usage });
      } catch {
        voiceTier = "AI-OK";
      }
    }

    await mkdir(STORE, { recursive: true });
    await writeFile(
      join(STORE, `${id}.json`),
      JSON.stringify(
        {
          id,
          brief,
          ratio,
          brandKitId: kit?.id,
          brandKitName: kit?.name,
          palette: kit?.colors,
          voiceTier,
          usage: usageLog,
          storyboard,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return NextResponse.json({ id, storyboard: storyboard as Storyboard, voiceTier, usage: usageLog });
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
  storyboard: unknown,
): Promise<{ tier: (typeof TIERS)[number]; usage: { model: string; prompt: number; completion: number; total: number } }> {
  const { chatJsonU } = await import("@/lib/zen");
  const { json: d, usage } = await chatJsonU<{ tier?: string }>(
    `You are the VOICE-TIER GATE of an agentic motion-graphics engine.
Classify the video by trust threshold & emotion load into exactly one tier:
- AI-OK: data/news/technical explainers where a clean AI voice is trusted.
- Hybrid: documentary/explainer with story elements — AI body, human hook/outro.
- Human-only: emotional, personal, or testimonial stories — never AI-narrated.
Return ONLY valid JSON: {"tier":"..."}.`,
    JSON.stringify({ brief, formatArchetype: (storyboard as { formatArchetype?: string })?.formatArchetype, scenes: (storyboard as { scenes?: { verb: string }[] })?.scenes?.map((s) => s.verb) }),
  );
  const tier = d?.tier;
  return {
    tier: TIERS.includes(tier as (typeof TIERS)[number]) ? (tier as (typeof TIERS)[number]) : "AI-OK",
    usage,
  };
}