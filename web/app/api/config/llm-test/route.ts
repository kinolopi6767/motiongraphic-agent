import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { chatJson } from "@/lib/zen";

export const runtime = "nodejs";

/**
 * Test the configured LLM (Settings → AI model): one tiny JSON round-trip.
 * Exposed free lines: mimo-v2.5-free, deepseek-v4-flash-free (opencode-go key).
 */
export async function GET() {
  const cfg = await readConfig();
  try {
    const d = await chatJson<{ ok: boolean }>(
      "You are a connectivity probe. Reply with ONLY valid JSON.",
      '{"reply":"exactly this"}',
      0,
    );
    return NextResponse.json({ ok: true, model: cfg.llm.model, echo: d });
  } catch (e) {
    return NextResponse.json(
      { ok: false, model: cfg.llm.model, error: e instanceof Error ? e.message : "probe failed" },
      { status: 502 },
    );
  }
}
