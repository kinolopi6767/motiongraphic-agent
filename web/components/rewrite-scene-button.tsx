"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

/**
 * Agentic edit (Flow C): re-runs the scene agent on ONE scene with an optional
 * plain-language instruction — the scene is recreated in place (verb, values,
 * hook/microhook) while keeping its duration and the video's style colors.
 */
export function RewriteSceneButton({
  storyboardId,
  index,
}: {
  storyboardId: string;
  index: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 100_000);
    try {
      const res = await fetch(`/api/storyboards/${storyboardId}/scenes/${index}/recreate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() || undefined }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `rewrite failed (${res.status})`);
      }
      setSaved(true);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Can't reach the server — is npm run dev running?"
          : e instanceof Error
            ? e.message
            : "rewrite failed",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {saved ? "Rewritten ✓" : "Rewrite scene"}
      </Button>
      {open && (
        <div className="flex w-full min-w-[320px] flex-col gap-2 rounded-ctl border border-border-subtle bg-surface-2 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-text-low">
              Instruction (optional — plain language)
            </span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="e.g. make the headline punchier, use a chart instead"
              className="resize-y rounded-ctl border border-border-subtle bg-surface-1 px-2.5 py-2 text-[13px] outline-none placeholder:text-text-low focus:border-accent"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={run} disabled={busy}>
              {busy ? "Scene agent is rewriting…" : "Rewrite this scene"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
