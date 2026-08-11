"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

export function RenderButton({ storyboardId }: { storyboardId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const render = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storyboardId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `render failed (${res.status})`);
      }
      router.push("/studio/jobs");
    } catch (e) {
      setError(e instanceof Error ? e.message : "render failed");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={render} disabled={busy}>
        {busy ? "Queuing…" : "Render — start job"}
      </Button>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}