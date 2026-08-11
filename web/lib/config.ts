import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type VoiceConfig = {
  enabled: boolean;
  provider: "deepgram";
  apiKey: string;
  ttsModel: string;
  sttModel: string;
  voice: string;
  tier: "AI-OK" | "Hybrid" | "Human-only" | "auto";
  dictionary: string[];
};

export type LlmProvider = "zen" | "openai" | "anthropic" | "deepseek";

export type LlmConfig = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type AppConfig = {
  voice: VoiceConfig;
  llm: LlmConfig;
};

/** Provider presets (base URLs + starter models). Keys stay server-side. */
export const LLM_PROVIDERS: Record<
  LlmProvider,
  { label: string; baseUrl: string; models: string[]; needsKey: boolean; note: string }
> = {
  zen: {
    label: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    models: ["deepseek-v4-flash-free", "mimo-v2.5-free", "deepseek-v4-flash"],
    needsKey: false,
    note: "Uses the opencode-go key already attached to opencode — no key to paste.",
  },
  openai: {
    label: "ChatGPT (OpenAI)",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    needsKey: true,
    note: "Requires an OpenAI API key.",
  },
  anthropic: {
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-sonnet-4-5", "claude-haiku-4-5"],
    needsKey: true,
    note: "Requires an Anthropic API key.",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    needsKey: true,
    note: "Requires a DeepSeek API key.",
  },
};

export const AURA_VOICES = [
  "aura-2-thalia-en",
  "aura-2-orion-en",
  "aura-2-ares-en",
  "aura-2-perseus-en",
  "aura-2-helena-en",
  "aura-2-athena-en",
  "aura-2-zeus-en",
  "aura-2-pan-en",
];

const DEFAULT_CONFIG: AppConfig = {
  voice: {
    enabled: false, // Deepgram is DISABLED by default (PLAN §7)
    provider: "deepgram",
    apiKey: "",
    ttsModel: "aura-2-thalia-en",
    sttModel: "nova-3",
    voice: "aura-2-thalia-en",
    tier: "auto",
    dictionary: [],
  },
  llm: {
    provider: "zen",
    model: "deepseek-v4-flash-free",
    baseUrl: LLM_PROVIDERS.zen.baseUrl,
    apiKey: "",
  },
};

export async function readConfig(): Promise<AppConfig> {
  try {
    const raw = JSON.parse(await readFile(join(process.cwd(), "data", "config.json"), "utf8"));
    return {
      voice: { ...DEFAULT_CONFIG.voice, ...(raw.voice ?? {}) },
      llm: { ...DEFAULT_CONFIG.llm, ...(raw.llm ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export async function writeConfig(cfg: AppConfig): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(join(process.cwd(), "data", "config.json"), JSON.stringify(cfg, null, 2));
}

/** Sanitized view for clients — the API key never leaves the server. */
export function sanitizeConfig(cfg: AppConfig) {
  return {
    voice: {
      enabled: cfg.voice.enabled,
      provider: cfg.voice.provider,
      hasKey: cfg.voice.apiKey.length > 0,
      ttsModel: cfg.voice.ttsModel,
      sttModel: cfg.voice.sttModel,
      voice: cfg.voice.voice,
      tier: cfg.voice.tier,
      dictionary: cfg.voice.dictionary,
    },
    llm: {
      provider: cfg.llm.provider,
      model: cfg.llm.model,
      baseUrl: cfg.llm.baseUrl,
      hasKey: cfg.llm.apiKey.length > 0,
    },
  };
}
