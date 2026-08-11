"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Verb } from "@/lib/storyboard";

type Row = { label?: string; value?: string; color?: string };

function num(v: string): number | undefined {
  const n = v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function Chip({
  value,
  onCommit,
  type = "text",
  title,
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: "text" | "number";
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        title={title ?? "click to edit"}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="inline-flex min-h-[28px] items-center rounded-full border border-border-subtle bg-surface-2 px-2.5 text-[13px] text-text-hi transition-colors hover:border-accent hover:bg-accent-soft"
      >
        {type === "number" && <span className="mr-1 text-text-low">#</span>}
        {value === "" ? <span className="text-text-low italic">empty</span> : value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label={title ?? "edit value"}
      className="min-h-[28px] w-28 rounded-full border border-accent bg-surface-1 px-2.5 text-[13px] outline-none"
    />
  );
}

export function ValuesChips({
  storyboardId,
  index,
  verb,
  values,
}: {
  storyboardId: string;
  index: number;
  verb: Verb;
  values: Record<string, unknown>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, unknown>>(() => JSON.parse(JSON.stringify(values)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const patch = async (v: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/storyboards/${storyboardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ index, scene: { values: v } }),
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
      setBusy(false);
    }
  };

  const commit = (v: Record<string, unknown>) => {
    setDraft(v);
    patch(v);
  };

  const rowChips = (key: string, rowKeys: Array<{ k: keyof Row; title: string }>) => {
    const items = (Array.isArray(draft[key]) ? draft[key] : []) as Row[];
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((row, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-1 p-0.5">
            {rowKeys.map((rk) => (
              <Chip
                key={String(rk.k)}
                value={String(row[rk.k] ?? "")}
                title={rk.title}
                type={rk.k === "value" ? "number" : "text"}
                onCommit={(nv) => {
                  const next = items.map((r, j) => (j === i ? { ...r, [rk.k]: nv } : r));
                  commit({ ...draft, [key]: next });
                }}
              />
            ))}
          </span>
        ))}
        <button
          type="button"
          title={`add ${key.slice(0, -1)}`}
          className="flex size-7 items-center justify-center rounded-full border border-dashed border-border-subtle text-text-low transition-colors hover:border-accent hover:text-text-hi"
          onClick={() => commit({ ...draft, [key]: [...items, {}] })}
          aria-label={`Add row to ${key}`}
        >
          +
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 text-[13px]" aria-label={`Scene ${index + 1} values`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {verb === "count-up" && (
          <>
            <Chip value={String(draft.value ?? "")} type="number" title="value — the number being counted up" onCommit={(nv) => commit({ ...draft, value: num(nv) })} />
            <Chip value={String(draft.label ?? "")} title="label" onCommit={(nv) => commit({ ...draft, label: nv })} />
            <Chip value={String(draft.prefix ?? "")} title="prefix" onCommit={(nv) => commit({ ...draft, prefix: nv })} />
            <Chip value={String(draft.suffix ?? "")} title="suffix" onCommit={(nv) => commit({ ...draft, suffix: nv })} />
            <span title="accent color" className="size-5 rounded-full border border-border-subtle" style={{ background: String(draft.accent ?? "#818cf8") }} />
          </>
        )}
        {verb === "chart-race" && (
          <>
            <Chip value={String(draft.title ?? "")} title="chart title" onCommit={(nv) => commit({ ...draft, title: nv })} />
            {rowChips("items", [
              { k: "label", title: "item label" },
              { k: "value", title: "item value" },
              { k: "color", title: "item color" },
            ])}
          </>
        )}
        {verb === "kinetic-title" && (
          <>
            <Chip value={String(draft.kicker ?? "")} title="kicker" onCommit={(nv) => commit({ ...draft, kicker: nv })} />
            {rowChips("lines", [{ k: "label", title: "headline line" }])}
            <Chip value={String(draft.accentOn ?? "")} type="number" title="accentOn — line index highlighted" onCommit={(nv) => commit({ ...draft, accentOn: num(nv) })} />
            <span title="accent color" className="size-5 rounded-full border border-border-subtle" style={{ background: String(draft.accent ?? "#818cf8") }} />
          </>
        )}
        {verb === "pipeline-flow" && (
          <>
            <Chip value={String(draft.title ?? "")} title="pipeline title" onCommit={(nv) => commit({ ...draft, title: nv })} />
            {rowChips("nodes", [
              { k: "label", title: "stage label" },
              { k: "color", title: "stage color" },
            ])}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 text-[12px]">
        {busy && <span className="text-text-low">saving…</span>}
        {!busy && saved && <span className="text-ok">saved ✓</span>}
        {error && <span className="text-danger">{error} — click a chip to retry</span>}
      </div>
    </div>
  );
}