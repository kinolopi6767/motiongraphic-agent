import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Server-only Zen LLM client (same free line as the pipeline's src/llm.mjs).
 * Key resolution: env VISION_API_KEY / OPENCODE_API_KEY, else opencode auth.json.
 */
const ZEN_URL = process.env.ZEN_URL || "https://opencode.ai/zen/v1";
const MODEL = process.env.ZEN_MODEL || "mimo-v2.5-free";

async function authKey(): Promise<string> {
  for (const p of [
    process.env.VISION_API_KEY,
    process.env.OPENCODE_API_KEY,
    join(homedir(), ".local/share/opencode/auth.json"),
  ]) {
    if (!p) continue;
    if (p.includes("{")) return p;
    try {
      const d = JSON.parse(await readFile(/* turbopackIgnore: true */ p, "utf8"));
      if (d?.["opencode-go"]?.key) return d["opencode-go"].key;
      if (d?.opencode?.key) return d.opencode.key;
      if (d?.key) return d.key;
    } catch {}
  }
  throw new Error("no opencode/zen auth key found");
}

export async function chatJson<T>(system: string, prompt: string, temperature = 0.4): Promise<T> {
  const key = await authKey();
  const res = await fetch(`${ZEN_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: "system", content: system + "\n\nReply with ONLY valid JSON. No markdown fences." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim()) as T;
}