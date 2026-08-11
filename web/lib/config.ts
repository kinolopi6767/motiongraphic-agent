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

export type AppConfig = {
  voice: VoiceConfig;
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
};

export async function readConfig(): Promise<AppConfig> {
  try {
    const raw = JSON.parse(await readFile(join(process.cwd(), "data", "config.json"), "utf8"));
    return {
      voice: { ...DEFAULT_CONFIG.voice, ...(raw.voice ?? {}) },
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
  };
}
