"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { BrandKitWizard } from "@/components/brand-kit-wizard";
import { BrandKit } from "@/lib/brand-kits";

type KitList = BrandKit;

export function BrandKitsSection() {
  const [kits, setKits] = useState<KitList[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await fetch("/api/brand-kits").then((r) => r.json());
      setKits(d.kits ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoaded(true));
  }, [refresh]);

  const remove = async (id: string) => {
    await fetch(`/api/brand-kits/${id}`, { method: "DELETE" });
    setKits((ks) => ks.filter((k) => k.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const editing = kits.find((k) => k.id === editingId) ?? null;

  return (
    <section aria-label="Brand kits" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-text-hi">Brand kits</h2>
          <p className="mt-1 text-[13px] text-text-med">
            Name → palette → vibe, with live WCAG contrast checks. Picked in the brief composer and
            enforced by the director.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreating((c) => !c)}>
          {creating ? "Close" : "New kit"}
        </Button>
      </div>

      {creating && (
        <div className="mt-4 rounded-card border border-border-subtle bg-surface-1 p-5">
          <BrandKitWizard
            onDone={() => {
              setCreating(false);
              refresh();
            }}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {kits.map((k) => (
          <article key={k.id} className="rounded-card border border-border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-semibold">{k.name}</p>
              <span className="text-[12px] capitalize text-text-low">{k.vibe}</span>
            </div>
            <div className="mt-3 flex items-center gap-2" aria-label={`${k.name} palette`}>
              {k.colors.map((c) => (
                <span
                  key={c}
                  title={c}
                  className="size-8 rounded-lg border border-border-subtle"
                  style={{ background: c }}
                />
              ))}
              <span className="ml-2 text-[12px] tabular-nums text-text-low">
                {k.colors.length} colors
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                <Link href={`/studio?kit=${k.id}`} className="flex items-center">
                  Use in a brief
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingId(editingId === k.id ? null : k.id)}
              >
                {editingId === k.id ? "Close" : "Edit"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(k.id)}>
                Delete
              </Button>
            </div>
            {editingId === k.id && (
              <div className="mt-4 rounded-ctl border border-border-subtle bg-surface-2 p-4">
                <BrandKitWizard
                  kit={editing}
                  onDone={() => {
                    setEditingId(null);
                    refresh();
                  }}
                />
              </div>
            )}
          </article>
        ))}
        {loaded && kits.length === 0 && !creating && (
          <div className="rounded-card border border-dashed border-border-subtle p-8 text-center text-[14px] text-text-med">
            No kits yet. “New kit” is the first run of the brand wizard — Studio Black ships with
            every storyboard until you build your own.
          </div>
        )}
      </div>
    </section>
  );
}
