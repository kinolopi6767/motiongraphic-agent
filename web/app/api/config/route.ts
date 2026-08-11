import { NextRequest, NextResponse } from "next/server";
import { AURA_VOICES, readConfig, sanitizeConfig, writeConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(sanitizeConfig(await readConfig()));
}

export async function PUT(req: NextRequest) {
  let body: {
    enabled?: unknown;
    apiKey?: unknown;
    ttsModel?: unknown;
    sttModel?: unknown;
    voice?: unknown;
    tier?: unknown;
    dictionary?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const cfg = await readConfig();
  if (body.enabled !== undefined) cfg.voice.enabled = Boolean(body.enabled);
  if (body.apiKey !== undefined) {
    const key = String(body.apiKey).trim();
    if (key !== "" && !/^[A-Za-z0-9_]{8,}$/.test(key)) {
      return NextResponse.json({ error: "invalid API key format" }, { status: 400 });
    }
    if (key !== "") cfg.voice.apiKey = key;
    else if (body.apiKey === "") cfg.voice.apiKey = "";
  }
  if (body.ttsModel !== undefined && typeof body.ttsModel === "string" && body.ttsModel.length > 3) {
    cfg.voice.ttsModel = body.ttsModel;
    if (body.voice === undefined) cfg.voice.voice = body.ttsModel;
  }
  if (body.voice !== undefined && typeof body.voice === "string" && AURA_VOICES.includes(body.voice)) {
    cfg.voice.voice = body.voice;
    cfg.voice.ttsModel = body.voice;
  }
  if (body.sttModel !== undefined && typeof body.sttModel === "string" && body.sttModel.length > 3) {
    cfg.voice.sttModel = body.sttModel;
  }
  if (body.tier !== undefined) {
    const t = String(body.tier);
    if (!["AI-OK", "Hybrid", "Human-only", "auto"].includes(t)) {
      return NextResponse.json({ error: "tier must be AI-OK | Hybrid | Human-only | auto" }, { status: 400 });
    }
    cfg.voice.tier = t as typeof cfg.voice.tier;
  }
  if (body.dictionary !== undefined) {
    if (!Array.isArray(body.dictionary) || body.dictionary.some((d) => typeof d !== "string")) {
      return NextResponse.json({ error: "dictionary must be a list of proper nouns" }, { status: 400 });
    }
    cfg.voice.dictionary = (body.dictionary as string[])
      .map((d) => d.trim())
      .filter((d) => d.length > 0)
      .slice(0, 50);
  }
  await writeConfig(cfg);
  return NextResponse.json({ ok: true });
}

/** Test the Deepgram connection with a short TTS+STT round-trip. */
export async function POST(req: NextRequest) {
  const cfg = await readConfig();
  if (!cfg.voice.apiKey) {
    return NextResponse.json({ error: "no API key configured" }, { status: 400 });
  }
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const text =
    typeof body.text === "string" && body.text.trim().length > 0
      ? body.text.trim()
      : "Motion Graphic Agent. One two three.";
  try {
    const { DeepgramClient } = await import("@deepgram/sdk");
    const client = new DeepgramClient({ apiKey: cfg.voice.apiKey });
    const res = await client.speak.v1.audio.generate({
      text,
      model: cfg.voice.ttsModel,
      encoding: "linear16",
      container: "wav",
    });
    const chunks: Buffer[] = [];
    const stream = res.stream();
    if (stream) {
      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(Buffer.from(value));
      }
    }
    if (chunks.length === 0) {
      return NextResponse.json({ error: "empty TTS response" }, { status: 502 });
    }
    const buf = Buffer.concat(chunks);
    const durationSec = (buf.length - 44) / 2 / 24000;
    return NextResponse.json({ ok: true, bytes: buf.length, durationSec: Number(durationSec.toFixed(2)) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "deepgram test failed" },
      { status: 502 }
    );
  }
}
