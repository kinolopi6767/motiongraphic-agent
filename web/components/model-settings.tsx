"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/button";

const PROVIDERS = [
  { id: "zen", label: "OpenCode Zen", models: ["deepseek-v4-flash-free", "mimo-v2.5-free", "deepseek-v4-flash"], needsKey: false, note: "Auto-uses the opencode-go key attached to opencode — nothing to paste." },
  { id: "openai", label: "ChatGPT (OpenAI)", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"], needsKey: true, note: "OpenAI Chat Completions. Paste a sk-… key." },
  { id: "anthropic", label: "Claude (Anthropic)", models: ["claude-sonnet-4-5", "claude-haiku-4-5"], needsKey: true, note: "Claude Messages API. Paste a sk-ant-… key." },
  { id: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"], needsKey: true, note: "Official DeepSeek API. Paste a sk-… key." },
] as const;

export function ModelSettings() {
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setProvider(d.llm?.provider ?? "zen");
        setModel(d.llm?.model ?? "deepseek-v4-flash-free");
        setHasKey(Boolean(d.llm?.hasKey));
      })
      .catch(() => {});
  }, []);

  const persist = useCallback(
    async (p: { provider: string; model: string; llmApiKey?: string }) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/config", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(p),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "save failed");
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "save failed");
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const selectProvider = (id: string) => {
    const p = PROVIDERS.find((x) => x.id === id);
    if (!p) return;
    setProvider(id);
    setModel(p.models[0]);
    persist({ provider: id, model: p.models[0] });
  };

  const selectModel = (m: string) => {
    setModel(m);
    persist({ provider: provider ?? "zen", model: m });
  };

  const saveKey = async () => {
    await persist({ provider: provider ?? "zen", model: model ?? "", llmApiKey: key || undefined });
    setKey("");
    setHasKey(true);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/config/llm-test");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "test failed");
      setTestResult(`OK — ${d.usage?.prompt ?? "?"} in / ${d.usage?.completion ?? "?"} out tokens`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "test failed");
    } finally {
      setTesting(false);
    }
  };

  if (provider === null || model === null) return <p className="text-[13px] text-text-med">Loading…</p>;

  const active = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const needsKey = active.needsKey && !hasKey && !key;

  return (
    <div className="flex flex-col gap-4">
      {/* Current-model readout — always visible */}
      <div className="rounded-ctl border border-accent/40 bg-accent-soft px-3 py-2.5" role="status">
        <span className="text-[11px] uppercase tracking-wide text-text-low">Current model</span>
        <p className="mt-0.5 text-[15px] font-semibold text-accent-strong">
          {model}
          <span className="ml-2 text-[13px] font-normal text-text-med">· {active.label}</span>
        </p>
        <p className="mt-0.5 text-[12px] text-text-low">
          Used by the director, hook engineer, voice-tier gate and the render pipeline.
        </p>
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="LLM provider">
        {PROVIDERS.map((p) => {
          const activeP = provider === p.id;
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-ctl border px-3 py-2.5 transition-colors ${
                activeP ? "border-accent bg-accent-soft" : "border-border-subtle bg-surface-2"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="llm-provider"
                  checked={activeP}
                  onChange={() => selectProvider(p.id)}
                  className="size-4 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-[14px] font-medium text-text-hi">{p.label}</span>
                  <span className="block text-[12px] text-text-low">{p.note}</span>
                </span>
              </span>
              {activeP && <span className="text-[12px] font-medium text-accent-strong">active</span>}
            </label>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-low">Model</span>
          <input
            list="llm-model-suggestions"
            value={model ?? ""}
            onChange={(e) => selectModel(e.target.value)}
            className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
          />
          <datalist id="llm-model-suggestions">
            {active.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {active.models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectModel(m)}
                className={`rounded-full border px-2 py-0.5 text-[12px] transition-colors ${
                  model === m
                    ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                    : "border-border-subtle text-text-med hover:border-accent"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </label>
        {active.needsKey && (
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-text-low">
              API key {hasKey && "(saved — new one replaces)"}
            </span>
            <div className="flex gap-2">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={hasKey ? "•••••••• (unchanged)" : "sk-…"}
                autoComplete="off"
                className="min-h-[36px] flex-1 rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
              />
              <Button size="sm" variant="outline" onClick={saveKey} disabled={!key}>
                Save key
              </Button>
            </div>
          </label>
        )}
      </div>

      {saved && <p className="text-[13px] text-ok">Saved — the next director/hook call uses it.</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
      {testResult && <p className="text-[13px] text-ok">{testResult}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={test} disabled={testing || needsKey || saving}>
          {testing ? "Testing…" : "Test model connection"}
        </Button>
        {needsKey && (
          <span className="text-[12px] text-warn">{active.label} needs an API key to test</span>
        )}
      </div>
    </div>
  );
}
