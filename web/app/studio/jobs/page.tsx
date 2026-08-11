"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";

type Job = {
  id: string;
  storyboardId?: string;
  status: "queued" | "running" | "done" | "failed";
  error?: string;
  logFile?: string;
  createdAt: string;
  finishedAt?: string;
};

const tone: Record<Job["status"], "neutral" | "accent" | "ok" | "danger" | "warn"> = {
  queued: "neutral",
  running: "accent",
  done: "ok",
  failed: "danger",
};

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
    const iv = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <AppShell projectTitle="Jobs">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
          Render queue
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-[14px] text-text-med">
          Polls automatically while a job is active.
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
                  <div className="flex items-center gap-2">
                    <Badge tone={tone[j.status]}>{j.status}</Badge>
                    <span className="text-[14px] font-semibold tabular-nums">{j.id}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-text-med">
                    {j.storyboardId ? (
                      <Link href={`/studio/${j.storyboardId}`} className="underline decoration-border-subtle underline-offset-2 hover:text-text-hi">
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
              {j.logFile && j.status === "failed" && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[13px] text-text-med">Log</summary>
                  <a
                    className="mt-2 block text-[13px] text-accent-strong underline underline-offset-2"
                    href={`/api/jobs/${j.id}/video`}
                    onClick={(e) => e.preventDefault()}
                  >
                    (server log at {j.logFile})
                  </a>
                </details>
              )}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}