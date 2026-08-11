"use client";

import { useEffect, useState } from "react";

type UsageEntry = { at: string; kind: string; model: string; prompt: number; completion: number; total: number };
type UsageData = {
  totals: { prompt: number; completion: number; total: number };
  byModel: Record<string, { prompt: number; completion: number; total: number; calls: number }>;
  perBoard: { id: string; title: string; total: number; usage: UsageEntry[] }[];
};

export function UsageSection() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <p className="text-[13px] text-text-med">Loading…</p>;
  const modelRows = Object.entries(data.byModel);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-[13px] text-text-low">Total tokens</p>
          <p className="text-2xl font-semibold tabular-nums">{data.totals.total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[13px] text-text-low">Prompt</p>
          <p className="text-2xl font-semibold tabular-nums">{data.totals.prompt.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[13px] text-text-low">Completion</p>
          <p className="text-2xl font-semibold tabular-nums">{data.totals.completion.toLocaleString()}</p>
        </div>
      </div>

      {modelRows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {modelRows.map(([model, m]) => (
            <li key={model} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-text-med">
                {model} <span className="text-text-low">· {m.calls} call{m.calls === 1 ? "" : "s"}</span>
              </span>
              <span className="tabular-nums text-text-hi">{m.total.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      {data.perBoard.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {data.perBoard.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate">
                <a
                  href={`/studio/${b.id}`}
                  className="underline decoration-border-subtle underline-offset-2 hover:text-text-hi"
                >
                  {b.title}
                </a>
                <span className="ml-2 text-[12px] text-text-low">
                  {b.usage.map((u) => `${u.kind} ${u.total}`).join(" · ")}
                </span>
              </span>
              <span className="tabular-nums text-text-med">{b.total.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-text-low">
          No usage yet — the director, hook engineer and voice-tier calls are counted here.
        </p>
      )}
    </div>
  );
}
