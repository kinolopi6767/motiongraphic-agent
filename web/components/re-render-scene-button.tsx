"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

/**
 * Zero-gap segment re-render (UI-PLAN §2.3 / Phase 5): renders ONLY this
 * scene's segment and splices it into the cached segments of the previous
 * render — the rest of the video is untouched and bit-identical.
 */
export function ReRenderSceneButton({
  storyboardId,
  index,
  hasPreviousRender,
}: {
  storyboardId: string;
  index: number;
  hasPreviousRender: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storyboardId, sceneIndex: index }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `queue failed (${res.status})`);
      }
      router.push("/studio/jobs");
    } catch (e) {
      setError(e instanceof Error ? e.message : "queue failed");
      setBusy(false);
    }
  };

  if (!hasPreviousRender) return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="ghost" size="sm" onClick={queue} disabled={busy} title="Re-renders only this scene's segment — the rest stays cached">
        {busy ? "Queuing…" : "Re-render scene"}
      </Button>
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </div>
  );
}
