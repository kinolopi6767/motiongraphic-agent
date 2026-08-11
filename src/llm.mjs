#!/usr/bin/env node
/**
 * llm.mjs — minimal LLM client for the agent pipeline.
 * Providers (env): LLM_PROVIDER=zen|openai|anthropic|deepseek,
 * LLM_BASE_URL, LLM_API_KEY, LLM_MODEL. zen auto-uses the opencode-go key.
 * Text + JSON modes. Usage is logged to stderr (the web worker captures it).
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const ZEN_URL = process.env.ZEN_URL || "https://opencode.ai/zen/v1";
const PROVIDER = process.env.LLM_PROVIDER || "zen";
const BASE_URL = process.env.LLM_BASE_URL || ZEN_URL;
const API_KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "mimo-v2.5-free";

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
  const key = PROVIDER === "zen" ? await authKey() : API_KEY;
  if (!key) throw new Error(`llm: ${PROVIDER} needs LLM_API_KEY`);
  const base = BASE_URL.replace(/\/$/, "");

  let res;
  if (PROVIDER === "anthropic") {
    res = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        temperature,
        system: system + (json ? "\n\nReply with ONLY valid JSON. No markdown fences." : ""),
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } else {
    res = await fetch(`${base}/chat/completions`, {
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
  }
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text =
    PROVIDER === "anthropic"
      ? (data.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
      : (data.choices?.[0]?.message?.content ?? "");
  const u = data.usage ?? {};
  const promptT = u.prompt_tokens ?? u.input_tokens ?? 0;
  const compT = u.completion_tokens ?? u.output_tokens ?? 0;
  console.error(`[llm] ${PROVIDER}/${MODEL}: ${promptT} in + ${compT} out = ${promptT + compT} tokens`);
  if (!json) return text.trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}
