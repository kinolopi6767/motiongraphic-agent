"use client";

import { useState } from "react";
import { Button } from "@/components/button";

export function WhyLook({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide rationale" : "Why look"}
      </Button>
      {open && (
        <ul className="flex flex-col gap-1.5 rounded-ctl border border-border-subtle bg-surface-2 p-3 text-[13px] leading-relaxed text-text-med">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-accent-strong">
                →
              </span>
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}