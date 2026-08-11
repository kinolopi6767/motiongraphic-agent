"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm(`Delete storyboard ${id}? Renders already produced stay on disk.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/storyboards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : "Delete"}
      </Button>
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </span>
  );
}