"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";

type VoiceCfg = {
  enabled: boolean;
  hasKey: boolean;
  ttsModel: string;
  sttModel: string;
  voice: string;
  tier: string;
  dictionary: string[];
};

const AURA_VOICES = [
  "aura-2-thalia-en",
  "aura-2-orion-en",
  "aura-2-ares-en",
  "aura-2-perseus-en",
  "aura-2-helena-en",
  "aura-2-athena-en",
  "aura-2-zeus-en",
  "aura-2-pan-en",
];

const TIERS = ["auto", "AI-OK", "Hybrid", "Human-only"];

export function VoiceSettings() {
  const [cfg, setCfg] = useState<VoiceCfg | null>(null);
  const [key, setKey] = useState("");
  const [dictText, setDictText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setCfg(d.voice);
        setDictText((d.voice?.dictionary ?? []).join("\n"));
      })
      .catch(() => {});
  }, []);

  const patch = (p: Partial<VoiceCfg>) => setCfg((c) => (c ? { ...c, ...p } : c));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: cfg?.enabled,
          apiKey: key,
          voice: cfg?.voice,
          sttModel: cfg?.sttModel,
          tier: cfg?.tier,
          dictionary: dictText.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "save failed");
      }
      setKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "test failed");
      setTestResult(`OK — ${d.durationSec}s of speech (${d.bytes} bytes WAV)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "test failed");
    } finally {
      setTesting(false);
    }
  };

  if (!cfg) return <p className="text-[13px] text-text-med">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-text-med">
        Narration is <span className="font-semibold text-text-hi">disabled by default</span> (PLAN
        §7). When enabled: per-scene TTS → STT round-trip for word timestamps → captions (VTT +
        active-word) → muxed into the MP4, SFX ducked −12 dB under speech. The API key stays on
        this machine.
      </p>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="size-4 accent-[var(--accent)]"
        />
        <span className="text-[14px] font-medium">Enable Deepgram narration</span>
        {cfg.enabled && !cfg.hasKey && (
          <span className="text-[12px] text-warn">needs an API key</span>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-low">
            Deepgram API key {cfg.hasKey && "(saved — enter a new one to replace)"}
          </span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={cfg.hasKey ? "•••••••• (unchanged)" : "DG_…"}
            autoComplete="off"
            className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-low">TTS voice</span>
          <select
            value={cfg.voice}
            onChange={(e) => patch({ voice: e.target.value, ttsModel: e.target.value })}
            className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
          >
            {AURA_VOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-low">STT model (round-trip)</span>
          <input
            value={cfg.sttModel}
            onChange={(e) => patch({ sttModel: e.target.value })}
            className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-low">Voice tier (auto = classified per video)</span>
          <select
            value={cfg.tier}
            onChange={(e) => patch({ tier: e.target.value })}
            className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[12px] font-medium text-text-low">
            Pronunciation dictionary (one proper noun per line — injected as SSML aliases)
          </span>
          <textarea
            value={dictText}
            onChange={(e) => setDictText(e.target.value)}
            rows={3}
            placeholder={"HyperFrames\nGSAP"}
            className="resize-y rounded-ctl border border-border-subtle bg-surface-2 px-2.5 py-2 text-[14px] outline-none focus:border-accent"
          />
        </label>
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}
      {testResult && <p className="text-[13px] text-ok">{testResult}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || !cfg.hasKey && !key}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save voice settings"}
        </Button>
        <Button size="sm" variant="outline" onClick={test} disabled={testing || !cfg.hasKey}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {cfg.hasKey && (
          <span className="text-[12px] text-text-low">key configured ✓</span>
        )}
      </div>
    </div>
  );
}
