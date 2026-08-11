#!/usr/bin/env node
/**
 * llm.mjs — minimal LLM client for the agent pipeline.
 * Uses the OpenCode Zen endpoint with the local opencode auth key.
 * Text + JSON modes. Model/temperature overridable via env.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const ZEN_URL = process.env.ZEN_URL || "https://opencode.ai/zen/v1";
// Free line (same opencode-go key as the vision skill). Paid models need credits.
const MODEL = process.env.ZEN_MODEL || "mimo-v2.5-free";

async function authKey() {
  for (const p of [
    process.env.VISION_API_KEY,
    process.env.OPENCODE_API_KEY,
    join(homedir(), ".local/share/opencode/auth.json"),
  ]) {
    if (!p) continue;
    if (p.includes("{")) return p;
    try {
      const d = JSON.parse(await readFile(p, "utf8"));
      if (d?.["opencode-go"]?.key) return d["opencode-go"].key;
      if (d?.opencode?.key) return d.opencode.key;
      if (d?.key) return d.key;
    } catch {}
  }
  throw new Error("no opencode/zen auth key found");
}

export async function chat({ system, prompt, json = false, temperature = 0.4 }) {
  const key = await authKey();
  const res = await fetch(`${ZEN_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: "system", content: system + (json ? "\n\nReply with ONLY valid JSON. No markdown fences." : "") },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!json) return text.trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}
