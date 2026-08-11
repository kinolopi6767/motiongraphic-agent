"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";

const PROVIDERS = [
  { id: "zen", label: "OpenCode Zen", models: ["deepseek-v4-flash-free", "mimo-v2.5-free", "deepseek-v4-flash"], needsKey: false, note: "Auto-uses the opencode-go key already attached to opencode — nothing to paste. Free lines: deepseek-v4-flash-free, mimo-v2.5-free. Paid: deepseek-v4-flash (needs account credits)." },
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
        setModel(d.llm?.model ?? "mimo-v2.5-free");
        setHasKey(Boolean(d.llm?.hasKey));
      })
      .catch(() => {});
  }, []);

  const active = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const needsKey = active.needsKey && !hasKey && !key;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model, llmApiKey: key || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "save failed");
      }
      setKey("");
      setHasKey(Boolean(active.needsKey) || hasKey);
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
      const res = await fetch("/api/config/llm-test");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "test failed");
      setTestResult(
        `OK — ${d.model} · ${d.usage?.prompt ?? "?"} in / ${d.usage?.completion ?? "?"} out tokens`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "test failed");
    } finally {
      setTesting(false);
    }
  };

  if (provider === null) return <p className="text-[13px] text-text-med">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-text-med">
        The web studio (director, hooks, voice-tier) and the render pipeline share one model.
        Keys are stored on this machine (<code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">web/data/config.json</code>) — never in
        browser storage, because the render pipeline needs them too.
      </p>

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
                  onChange={() => {
                    setProvider(p.id);
                    setModel(p.models[0]);
                  }}
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
            onChange={(e) => setModel(e.target.value)}
            className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
          />
          <datalist id="llm-model-suggestions">
            {active.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        {active.needsKey && (
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-text-low">
              API key {hasKey && "(saved — new one replaces)"}
            </span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={hasKey ? "•••••••• (unchanged)" : "sk-…"}
              autoComplete="off"
              className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
            />
          </label>
        )}
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}
      {testResult && <p className="text-[13px] text-ok">{testResult}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || needsKey}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save model"}
        </Button>
        <Button size="sm" variant="outline" onClick={test} disabled={testing || needsKey}>
          {testing ? "Testing…" : "Test model connection"}
        </Button>
        {needsKey && (
          <span className="text-[12px] text-warn">{active.label} needs an API key</span>
        )}
      </div>
    </div>
  );
}
