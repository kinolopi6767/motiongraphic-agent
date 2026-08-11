"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

export function RenderButton({
  storyboardId,
  costEstimate,
}: {
  storyboardId: string;
  costEstimate: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8));

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
        body: JSON.stringify({ storyboardId, seed }),
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

  const insufficient = balance !== null && balance < costEstimate;

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
              <span className="font-semibold text-text-hi">{costEstimate} credits</span> (1 credit
              per 15s of video).{" "}
              {balance !== null && (
                <>
                  Balance: <span className="font-semibold tabular-nums">{balance}</span>.
                </>
              )}{" "}
              Failed renders auto-refund.
            </p>
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
              <Button size="sm" onClick={start} disabled={busy || insufficient}>
                {busy ? "Queuing…" : "Confirm & queue"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}