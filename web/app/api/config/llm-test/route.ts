import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { chatJsonU } from "@/lib/zen";

export const runtime = "nodejs";

/**
 * Test the configured LLM (Settings → AI model): one tiny JSON round-trip.
 * Returns the token usage from the response.
 */
export async function GET() {
  const cfg = await readConfig();
  try {
    const { json, usage } = await chatJsonU<{ reply: string }>(
      "You are a connectivity probe. Reply with ONLY valid JSON.",
      '{"reply":"exactly this"}',
      0,
    );
    return NextResponse.json({ ok: true, model: cfg.llm.model, provider: cfg.llm.provider, echo: json, usage });
  } catch (e) {
    return NextResponse.json(
      { ok: false, model: cfg.llm.model, provider: cfg.llm.provider, error: e instanceof Error ? e.message : "probe failed" },
      { status: 502 },
    );
  }
}
