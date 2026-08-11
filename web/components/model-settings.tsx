"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";

const MODELS = [
  { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash", note: "free · fast · reasoning" },
  { id: "mimo-v2.5-free", label: "Mimo v2.5", note: "free · general purpose" },
];

export function ModelSettings() {
  const [model, setModel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setModel(d.llm?.model ?? "mimo-v2.5-free"))
      .catch(() => {});
  }, []);

  const save = async (m: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: m }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "save failed");
      }
      setModel(m);
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
      setTestResult(`OK — ${d.model} answered: ${JSON.stringify(d.echo)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "test failed");
    } finally {
      setTesting(false);
    }
  };

  if (model === null) return <p className="text-[13px] text-text-med">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-text-med">
        Both the web studio (director, hooks, voice-tier) and the render pipeline use this model
        through the OpenCode Zen gateway with the local opencode-go key. Free lines only — paid
        models need credits on the account.
      </p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="AI model">
        {MODELS.map((m) => {
          const active = model === m.id;
          return (
            <label
              key={m.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-ctl border px-3 py-2.5 transition-colors ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-border-subtle bg-surface-2 hover:border-border-subtle"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="llm-model"
                  checked={active}
                  onChange={() => save(m.id)}
                  className="size-4 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-[14px] font-medium text-text-hi">{m.label}</span>
                  <span className="block text-[12px] text-text-low">{m.note}</span>
                </span>
              </span>
              {active && <span className="text-[12px] font-medium text-accent-strong">in use</span>}
            </label>
          );
        })}
      </div>
      {saved && <p className="text-[13px] text-ok">Saved — the next director/hook call uses it.</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
      {testResult && <p className="text-[13px] text-ok">{testResult}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={test} disabled={testing || saving}>
          {testing ? "Testing…" : "Test model connection"}
        </Button>
      </div>
    </div>
  );
}
