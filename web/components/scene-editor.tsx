"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Verb } from "@/lib/storyboard";

type Row = { label?: string; value?: string; color?: string };

function num(v: string | null | undefined): number | undefined {
  const n = v === "" || v === null || v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function SceneEditor({
  storyboardId,
  index,
  verb,
  initial,
  duration: initialDuration,
  hook: initialHook,
  microhook: initialMicrohook,
  tone: initialTone,
  approved: initialApproved = false,
}: {
  storyboardId: string;
  index: number;
  verb: Verb;
  initial: Record<string, unknown>;
  duration: number;
  hook?: string;
  microhook?: string;
  tone?: string;
  approved?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(() =>
    JSON.parse(JSON.stringify(initial))
  );
  const [duration, setDuration] = useState(String(initialDuration));
  const [hook, setHook] = useState(initialHook ?? "");
  const [microhook, setMicrohook] = useState(initialMicrohook ?? "");
  const [tone, setTone] = useState(initialTone ?? "");
  const [approved, setApproved] = useState(Boolean(initialApproved));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (k: string, v: unknown) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Numeric fields arrive as strings — coerce per verb before sending.
      const values: Record<string, unknown> = { ...draft };
      if (verb === "count-up") values.value = num(String(draft.value));
      if (verb === "chart-race") {
        values.items = ((draft.items ?? []) as Row[]).map((r) => ({
          ...r,
          value: num(String(r.value ?? "")),
        }));
      }
      if (verb === "kinetic-title" && draft.accentOn !== "") {
        values.accentOn = num(String(draft.accentOn));
      }
      const res = await fetch(`/api/storyboards/${storyboardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          index,
          scene: {
            duration: num(duration) ?? initialDuration,
            values,
            hook,
            microhook,
            tone,
            approved,
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `save failed (${res.status})`);
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggle = () => {
    setOpen((o) => !o);
    if (open) setDraft(JSON.parse(JSON.stringify(initial)));
  };

  const input = (k: string, placeholder: string, wide = false) => (
    <label className="flex flex-col gap-1" key={k}>
      <span className="text-[12px] font-medium text-text-low">{k}</span>
      <input
        value={String(draft[k] ?? "")}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className={`min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent ${
          wide ? "flex-1" : ""
        }`}
      />
    </label>
  );

  const rows = (key: string, rowKeys: Array<{ k: string; ph: string; wide?: boolean }>) => {
    const items = (Array.isArray(draft[key]) ? draft[key] : []) as Row[];
    return (
      <div key={key} className="flex flex-col gap-2">
        <span className="text-[12px] font-medium text-text-low">
          {key} · {items.length} (2-6)
        </span>
        <div className="flex flex-col gap-2">
          {items.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              {rowKeys.map((rk) => (
                <input
                  key={rk.k}
                  value={row[rk.k as keyof Row] ?? ""}
                  placeholder={rk.ph}
                  onChange={(e) => {
                    const next = items.map((r, j) => (j === i ? { ...r, [rk.k]: e.target.value } : r));
                    set(key, next);
                  }}
                  className={`min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent ${rk.wide ? "flex-1" : "w-24"}`}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${key} row ${i + 1}`}
                onClick={() => set(key, items.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => set(key, [...items, {}])}>
          + Add {key.slice(0, -1)}
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" size="sm" aria-expanded={open} onClick={toggle}>
        {open ? "Close" : "Edit"}
      </Button>
      {open && (
        <div className="flex w-full min-w-[320px] flex-col gap-3 rounded-ctl border border-border-subtle bg-surface-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-text-low">duration (s, 4-12)</span>
              <input
                type="number"
                min={4}
                max={12}
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
              />
            </label>
            {input("accent", "e.g. #818cf8")}
          </div>
          {verb === "count-up" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text-low">value (number)</span>
                <input
                  type="number"
                  value={String(draft.value ?? "")}
                  onChange={(e) => set("value", e.target.value)}
                  className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
                />
              </label>
              {input("label", "e.g. minutes saved")}
              <div className="grid grid-cols-2 gap-2">
                {input("prefix", "e.g. $")}
                {input("suffix", "e.g. %")}
              </div>
            </>
          )}
          {verb === "chart-race" && (
            <>
              {input("title", "e.g. Top 5 sources")}
              {rows("items", [
                { k: "label", ph: "label", wide: true },
                { k: "value", ph: "value" },
                { k: "color", ph: "#hex" },
              ])}
            </>
          )}
          {verb === "kinetic-title" && (
            <>
              {rows("lines", [{ k: "label", ph: "headline line", wide: true }])}
              {input("kicker", "e.g. HYPERFRAMES")}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-text-low">accentOn (line index)</span>
                  <input
                    type="number"
                    min={0}
                    value={String(draft.accentOn ?? "")}
                    onChange={(e) => set("accentOn", e.target.value)}
                    className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
                  />
                </label>
              </div>
            </>
          )}
          {verb === "pipeline-flow" && (
            <>
              {input("title", "e.g. Render pipeline")}
              {rows("nodes", [
                { k: "label", ph: "stage", wide: true },
                { k: "color", ph: "#hex" },
              ])}
            </>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-text-low">hook (cold-open line)</span>
              <input
                value={hook}
                onChange={(e) => {
                  setHook(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. Record-breaking launch"
                className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-text-low">microhook (pull to next)</span>
              <input
                value={microhook}
                onChange={(e) => {
                  setMicrohook(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. The impact continues…"
                className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[12px] font-medium text-text-low">tone</span>
              <input
                value={tone}
                onChange={(e) => {
                  setTone(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. bold, punchy"
                className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
              />
            </label>
          </div>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-text-low">background (#hex)</span>
              <input
                value={String(draft.bg ?? "")}
                onChange={(e) => set("bg", e.target.value)}
                placeholder="e.g. #0B0E13"
                className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-text-low">text color (#hex)</span>
              <input
                value={String(draft.textColor ?? "")}
                onChange={(e) => set("textColor", e.target.value)}
                placeholder="e.g. #F2F4F8"
                className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-1 px-2.5 text-[14px] outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => {
                setApproved(e.target.checked);
                setSaved(false);
              }}
              className="size-4 accent-[var(--accent)]"
            />
            <span className="text-[13px] text-text-med">
              Approved — reusable in the scene library
            </span>
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggle}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}