"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

const RATIOS = ["16:9", "1:1", "9:16"] as const;
const QUALITIES = [
  { id: "normal", label: "Normal", desc: "crf 23 · fastest" },
  { id: "medium", label: "Medium", desc: "crf 19" },
  { id: "max", label: "Max", desc: "crf 14 · extra animation" },
] as const;

export function RenderButton({
  storyboardId,
  costEstimate,
  initialQuality,
}: {
  storyboardId: string;
  costEstimate: number;
  initialQuality?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8));
  const [ratios, setRatios] = useState<string[]>(["16:9"]);
  const [quality, setQuality] = useState(initialQuality ?? "max");

  useEffect(() => {
    if (!confirming) return;
    let alive = true;
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setBalance(d.balance);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [confirming]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storyboardId, seed, ratios, quality }),
      });
      if (res.status === 402) {
        const d = await res.json();
        throw new Error(d.error ?? "insufficient credits");
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `render failed (${res.status})`);
      }
      setConfirming(false);
      router.push("/studio/jobs");
    } catch (e) {
      setError(e instanceof Error ? e.message : "render failed");
    } finally {
      setBusy(false);
    }
  };

  const insufficient = balance !== null && balance < costEstimate * ratios.length;
  const totalCost = costEstimate * ratios.length;

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={() => setConfirming(true)}>Render — {costEstimate} cr</Button>
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm render"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-card border border-border-subtle bg-surface-1 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[17px] font-semibold">Start render?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-text-med">
              This job costs{" "}
              <span className="font-semibold text-text-hi">{totalCost} credits</span> (1 credit per
              15s of video per ratio).{" "}
              {balance !== null && (
                <>
                  Balance: <span className="font-semibold tabular-nums">{balance}</span>.
                </>
              )}{" "}
              Failed renders auto-refund.
            </p>
            <fieldset className="mt-3">
              <legend className="text-[12px] font-medium text-text-low">Ratios</legend>
              <div className="mt-1.5 flex gap-2">
                {RATIOS.map((r) => (
                  <label
                    key={r}
                    className={`flex min-h-[36px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-ctl border text-[13px] transition-colors ${
                      ratios.includes(r)
                        ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                        : "border-border-subtle text-text-med hover:text-text-hi"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ratios.includes(r)}
                      onChange={() =>
                        setRatios((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))
                      }
                      className="sr-only"
                    />
                    {r}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[12px] text-text-low">
                {ratios.length > 1
                  ? "One render pass, three ratios — the 16:9 master is scaled into safe-zone canvases."
                  : "The 16:9 master renders natively."}
              </p>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="text-[12px] font-medium text-text-low">Quality</legend>
              <div className="mt-1.5 flex gap-2">
                {QUALITIES.map((q) => (
                  <label
                    key={q.id}
                    className={`flex min-h-[36px] flex-1 cursor-pointer items-center justify-center gap-1 rounded-ctl border text-[13px] transition-colors ${
                      quality === q.id
                        ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                        : "border-border-subtle text-text-med hover:text-text-hi"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quality"
                      checked={quality === q.id}
                      onChange={() => setQuality(q.id)}
                      className="sr-only"
                    />
                    {q.label}
                    <span className={`text-[11px] font-normal ${quality === q.id ? "text-accent-strong" : "text-text-low"}`}>
                      {q.desc}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-2 text-[13px] text-text-med">
              <span className="font-medium text-text-hi">Free:</span> storyboards, edits, snapshots.
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-ctl border border-border-subtle bg-surface-2 px-3 py-2">
              <span className="text-[12px] text-text-low">Seed family</span>
              <span className="text-[13px] font-semibold tabular-nums">{seed}</span>
              <button
                type="button"
                onClick={() => setSeed(Math.random().toString(36).slice(2, 8))}
                aria-label="Roll a new seed family"
                title="Same seed = identical render; a new seed is a variation (PLAN variation engine)."
                className="ml-auto rounded-ctl border border-border-subtle px-2 py-0.5 text-[12px] text-text-med transition-colors hover:border-accent hover:text-accent-strong"
              >
                re-roll
              </button>
            </div>
            <p className="mt-2 text-[12px] text-text-low">
              Same seed → bit-identical output. New seed → a seeded variation of the same
              storyboard.
            </p>
            {insufficient && (
              <p role="alert" className="mt-3 rounded-ctl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                Not enough credits for this render.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-ctl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={start} disabled={busy || insufficient || ratios.length === 0}>
                {busy ? "Queuing…" : "Confirm & queue"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}