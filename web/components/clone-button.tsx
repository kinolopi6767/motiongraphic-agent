"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

export function CloneButton({ storyboardId }: { storyboardId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clone = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/storyboards/${storyboardId}/clone`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "clone failed");
      }
      const d = await res.json();
      router.push(`/studio/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "clone failed");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={clone} disabled={busy}>
        {busy ? "Cloning…" : "Make variant"}
      </Button>
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </div>
  );
}
