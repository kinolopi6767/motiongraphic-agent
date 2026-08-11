import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Server-only LLM client. Providers:
 *   zen       — OpenCode Zen gateway (auto-uses the opencode-go key attached
 *               to opencode; no key needed). Free lines: mimo-v2.5-free,
 *               deepseek-v4-flash-free; paid: deepseek-v4-flash (needs credits).
 *   openai    — OpenAI Chat Completions (sk-… key).
 *   anthropic — Claude Messages API (sk-ant-… key).
 *   deepseek  — DeepSeek Chat Completions (sk-… key).
 * Config from data/config.json (Settings → AI model); env overrides:
 * ZEN_URL / LLM_PROVIDER / LLM_BASE_URL / LLM_API_KEY / LLM_MODEL.
 */

const ZEN_URL = process.env.ZEN_URL || "https://opencode.ai/zen/v1";

export type Usage = { model: string; prompt: number; completion: number; total: number };

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

type Cfg = { provider: string; model: string; baseUrl: string; apiKey: string };

async function cfg(): Promise<Cfg> {
  const defaults = {
    provider: process.env.LLM_PROVIDER || "zen",
    model: process.env.LLM_MODEL || "mimo-v2.5-free",
    baseUrl: process.env.LLM_BASE_URL || ZEN_URL,
    apiKey: process.env.LLM_API_KEY || "",
  };
  try {
    const { readConfig } = await import("@/lib/config");
    const c = await readConfig();
    return {
      provider: c.llm.provider,
      model: c.llm.model,
      baseUrl: c.llm.baseUrl || defaults.baseUrl,
      apiKey: c.llm.apiKey || defaults.apiKey,
    };
  } catch {
    return defaults;
  }
}

async function apiKeyFor(c: Cfg): Promise<string> {
  if (c.provider === "zen") return await authKey(); // zen always uses the attached opencode-go key
  if (c.apiKey) return c.apiKey;
  throw new Error(`${c.provider} provider needs an API key — set it in Settings → AI model`);
}

function normalizeUsage(c: Cfg, raw: { usage?: Record<string, number> }): Usage {
  const u = raw.usage ?? {};
  const prompt = u.prompt_tokens ?? u.input_tokens ?? 0;
  const completion = u.completion_tokens ?? u.output_tokens ?? 0;
  return { model: c.model, prompt, completion, total: prompt + completion };
}

async function request<T>(c: Cfg, system: string, prompt: string, temperature: number): Promise<{ json: T; usage: Usage }> {
  const key = await apiKeyFor(c);
  const base = c.baseUrl.replace(/\/$/, "");
  const messages = [
    { role: "system", content: system + "\n\nReply with ONLY valid JSON. No markdown fences." },
    { role: "user", content: prompt },
  ];

  const doFetch = async (): Promise<{ data: Record<string, unknown>; status: number }> => {
    let res: Response;
    if (c.provider === "anthropic") {
      res = await fetch(`${base}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: c.model,
          max_tokens: 4096,
          temperature,
          system: messages[0].content,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } else {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: c.model, temperature, messages }),
      });
    }
    return { data: await res.json().catch(() => ({})), status: res.status };
  };

  // Retry with backoff on network errors, 429 (rate limit) and 5xx (server).
  let last: { data: Record<string, unknown>; status: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));
    try {
      const out = await doFetch();
      if (out.status >= 200 && out.status < 300) {
        const text: string =
          c.provider === "anthropic"
            ? ((out.data.content as Array<{ type: string; text: string }>) ?? [])
                .filter((b) => b.type === "text")
                .map((b) => b.text)
                .join("")
            : (((out.data.choices as Array<{ message: { content?: string } }>) ?? [])[0]?.message?.content ?? "");
        const json = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim()) as T;
        return { json, usage: normalizeUsage(c, out.data) };
      }
      if (out.status !== 429 && out.status < 500) {
        throw new Error(`LLM ${out.status}: ${JSON.stringify(out.data).slice(0, 300)}`);
      }
      last = out; // 429 / 5xx → retry
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(`LLM returned invalid JSON: ${String(e.message).slice(0, 200)}`);
      if (!(e instanceof Error) || !/LLM \d+:/.test(e.message)) {
        // network-level failure (fetch TypeError, timeouts) → retry
        last = null;
        if (attempt === 2) throw e;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`LLM ${last?.status ?? "?"}: ${JSON.stringify(last?.data ?? {}).slice(0, 300)}`);
}

/** JSON call that also returns token usage (brief, hooks, voice-tier). */
export async function chatJsonU<T>(
  system: string,
  prompt: string,
  temperature = 0.4,
): Promise<{ json: T; usage: Usage }> {
  return request<T>(await cfg(), system, prompt, temperature);
}

/** Plain JSON call (usage discarded). */
export async function chatJson<T>(system: string, prompt: string, temperature = 0.4): Promise<T> {
  return (await chatJsonU<T>(system, prompt, temperature)).json;
}
