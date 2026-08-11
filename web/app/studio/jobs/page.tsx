"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";

type Job = {
  id: string;
  storyboardId?: string;
  status: "queued" | "running" | "done" | "failed";
  stage?: string;
  cost?: number;
  refunded?: boolean;
  error?: string;
  logFile?: string;
  frames?: string[];
  seed?: string;
  createdAt: string;
  finishedAt?: string;
};

const tone: Record<Job["status"], "neutral" | "accent" | "ok" | "danger" | "warn"> = {
  queued: "neutral",
  running: "accent",
  done: "ok",
  failed: "danger",
};

const REFRESH_MS = 2500;

function LogViewer({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setOpen((o) => !o);
    if (open || log !== null) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/log`);
      if (!res.ok) throw new Error(String(res.status));
      setLog(await res.text());
    } catch {
      setError("log unavailable (worker may not have written it yet)");
    }
  };

  if (open) {
    return (
      <div className="mt-3">
        <pre className="max-h-64 overflow-auto rounded-ctl bg-surface-2 p-3 text-[12px] leading-relaxed text-text-med">
          {log ?? (error || "…")}
        </pre>
        <button
          type="button"
          className="mt-2 text-[13px] text-text-med underline underline-offset-2 hover:text-text-hi"
          onClick={() => setOpen(false)}
        >
          Hide log
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={load}
      className="mt-2 text-[13px] text-text-med underline underline-offset-2 hover:text-text-hi"
    >
      View log
    </button>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        if (!alive) return;
        setJobs(d.jobs ?? []);
        setBusy(false);
      } catch {
        if (alive) setBusy(false);
      }
    };
    tick();
    const iv = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const active = jobs.some((j) => j.status === "running" || j.status === "queued");

  return (
    <AppShell projectTitle="Jobs">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
          Render queue {active && <span className="animate-pulse text-accent">· live</span>}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-[14px] text-text-med">
          Polls automatically while a job is active. Failed jobs auto-refund their credits.
        </p>

        {busy && <p className="mt-8 text-[14px] text-text-med">Loading…</p>}
        {!busy && jobs.length === 0 && (
          <div className="mt-8 rounded-card border border-dashed border-border-subtle p-10 text-center text-[14px] text-text-med">
            No renders yet. Approve a storyboard and hit Render.
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-card border border-border-subtle bg-surface-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone[j.status]}>{j.status}</Badge>
                    {j.stage && j.stage !== j.status && (
                      <span className="text-[12px] uppercase tracking-wide text-text-low">
                        {j.stage}
                      </span>
                    )}
                    <span className="text-[14px] font-semibold tabular-nums">{j.id}</span>
                    {typeof j.cost === "number" && (
                      <span className="text-[12px] tabular-nums text-text-low">
                        {j.cost} cr{j.refunded && " · refunded"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-text-med">
                    {j.storyboardId ? (
                      <Link
                        href={`/studio/${j.storyboardId}`}
                        className="underline decoration-border-subtle underline-offset-2 hover:text-text-hi"
                      >
                        {j.storyboardId}
                      </Link>
                    ) : (
                      "—"
                    )}{" "}
                    · queued {new Date(j.createdAt).toLocaleTimeString()}
                    {j.finishedAt && ` · finished ${new Date(j.finishedAt).toLocaleTimeString()}`}
                  </p>
                  {j.error && <p className="mt-1 text-[13px] text-danger">{j.error}</p>}
                </div>
                {j.status === "done" && (
                  <video
                    src={`/api/jobs/${j.id}/video`}
                    controls
                    preload="metadata"
                    className="h-24 w-40 rounded-ctl border border-border-subtle bg-surface-2"
                  />
                )}
              </div>
              {j.status === "done" && (j.frames?.length ?? 0) > 0 && (
                <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
                  {j.frames?.map((_, i) => (
                    <img
                      key={i}
                      src={`/api/jobs/${j.id}/frames/${i}`}
                      alt={`contact sheet ${i + 1}`}
                      loading="lazy"
                      className="h-14 w-24 shrink-0 rounded-ctl border border-border-subtle bg-surface-2 object-cover"
                    />
                  ))}
                  {j.seed && (
                    <span className="ml-2 shrink-0 text-[11px] tabular-nums text-text-low">
                      seed {j.seed}
                    </span>
                  )}
                </div>
              )}
              {(j.status === "failed" || j.status === "done") && <LogViewer jobId={j.id} />}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}