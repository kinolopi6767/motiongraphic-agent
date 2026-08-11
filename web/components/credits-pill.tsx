"use client";

import { useEffect, useState } from "react";

export function CreditsPill() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/ledger");
        if (!res.ok) return;
        const d = await res.json();
        if (alive) setBalance(d.balance);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  if (balance === null) {
    return (
      <div className="flex items-center justify-between rounded-card border border-border-subtle bg-surface-2 px-3 py-2.5">
        <span className="text-[13px] text-text-med">Credits</span>
        <span className="text-[13px] tabular-nums text-text-low">…</span>
      </div>
    );
  }

  const low = balance <= 5;
  return (
    <div className="flex items-center justify-between rounded-card border border-border-subtle bg-surface-2 px-3 py-2.5">
      <span className="text-[13px] text-text-med">Credits</span>
      <span
        className={`text-[13px] font-semibold tabular-nums ${low ? "text-warn" : "text-text-hi"}`}
        title={low ? "Balance is low — failed renders auto-refund" : undefined}
      >
        {balance}
      </span>
    </div>
  );
}