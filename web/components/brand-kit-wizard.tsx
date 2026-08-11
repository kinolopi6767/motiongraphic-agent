"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import {
  BrandKit,
  BrandVibe,
  MAX_COLORS,
  VIBES,
  kitChecks,
} from "@/lib/brand-kits";

const DEFAULT_COLORS = ["#0B0E13", "#6366F1"];

export function BrandKitWizard({
  kit,
  onDone,
}: {
  kit?: BrandKit | null;
  onDone?: () => void;
}) {
  const [name, setName] = useState(kit?.name ?? "");
  const [colors, setColors] = useState<string[]>(kit?.colors ?? DEFAULT_COLORS);
  const [vibe, setVibe] = useState<BrandVibe>(kit?.vibe ?? "crisp");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const setColor = (i: number, v: string) => {
    setColors((c) => c.map((x, j) => (j === i ? v : x)));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { name, colors, vibe };
      const res = await fetch(kit ? `/api/brand-kits/${kit.id}` : "/api/brand-kits", {
        method: kit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "save failed");
      }
      setSaved(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  const checks = kitChecks(colors);
  const valid = name.trim().length >= 2 && colors.length >= 2 && checks.every((c) => c.whiteOk || c.onCanvas);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-low">Kit name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fintech Bold"
            aria-label="Kit name"
            className="min-h-[36px] rounded-ctl border border-border-subtle bg-surface-2 px-2.5 text-[14px] outline-none focus:border-accent"
          />
        </label>
        <fieldset>
          <legend className="text-[12px] font-medium text-text-low">Vibe</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {VIBES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vibe === v}
                onClick={() => setVibe(v)}
                className={`rounded-full border px-2.5 py-1 text-[12px] capitalize transition-colors ${
                  vibe === v
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border-subtle text-text-med hover:bg-surface-2"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium text-text-low">
          Palette · {colors.length}/{MAX_COLORS} colors (first = canvas)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {colors.map((c, i) => (
            <label key={i} className="flex flex-col gap-1" title={i === 0 ? "canvas color" : `accent ${i}`}>
              <span className="flex items-center gap-1">
                <span className="size-5 rounded-md border border-border-subtle" style={{ background: c }} />
                <input
                  value={c}
                  onChange={(e) => setColor(i, e.target.value)}
                  aria-label={`color ${i + 1}`}
                  className="w-24 rounded-ctl border border-border-subtle bg-surface-2 px-2 py-1 text-[12px] tabular-nums outline-none focus:border-accent"
                />
              </span>
              {i > 0 && colors.length > 2 && (
                <button
                  type="button"
                  aria-label={`remove color ${i + 1}`}
                  onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))}
                  className="text-left text-[11px] text-text-low hover:text-danger"
                >
                  remove
                </button>
              )}
            </label>
          ))}
          {colors.length < MAX_COLORS && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColors((c) => [...c, "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")])}
            >
              + Add color
            </Button>
          )}
        </div>
        {/* Live WCAG contrast validation (UI-PLAN Flow A ColorValidator). */}
        <ul className="flex flex-wrap gap-1.5" aria-live="polite">
          {checks.map((c) => (
            <li
              key={c.color}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                c.whiteOk && c.onCanvas
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : "border-warn/40 bg-warn/10 text-warn"
              }`}
            >
              {c.whiteOk && c.onCanvas ? "✓" : "▲"} {c.color} · white {c.vsWhite.toFixed(2)} · canvas{" "}
              {c.onCanvas.toFixed(2)}
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || !valid}>
          {saving ? "Saving…" : saved ? "Saved ✓" : kit ? "Save kit" : "Create kit"}
        </Button>
        {!valid && (
          <span className="text-[12px] text-text-low">
            Name it and give every color AA against white text or the canvas.
          </span>
        )}
      </div>
    </div>
  );
}
