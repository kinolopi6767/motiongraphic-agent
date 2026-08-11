"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";

type Motion = { scene: number; duration: number; frames: number; score: number; pass: boolean };

type Job = {
  id: string;
  storyboardId?: string;
  status: "queued" | "running" | "done" | "failed";
  stage?: string;
  kind?: "full" | "segment";
  sceneIndex?: number;
  quality?: string;
  cost?: number;
  refunded?: boolean;
  error?: string;
  logFile?: string;
  frames?: string[];
  frameTimes?: (number | null)[];
  motion?: Motion[];
  segments?: string[];
  thumbnailPath?: string;
  thumbnails?: Record<string, string>;
  videos?: Record<string, string>;
  ratios?: string[];
  sfx?: boolean;
  voice?: { tier?: string; words?: number; error?: string } | null;
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

/** Draft scrubber (UI-PLAN §2.3): click a contact-sheet frame → seek the player. */
function Filmstrip({ job }: { job: Job }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [words, setWords] = useState<{ word: string; start: number; end: number }[] | null>(null);
  const [ratio, setRatio] = useState<string | null>(null);
  const frames = job.frames ?? [];
  const times = job.frameTimes ?? [];
  const hasVoice = (job.voice?.words ?? 0) > 0;
  const ratios = job.ratios ?? [];

  const loadWords = () => {
    if (words || !hasVoice) return;
    fetch(`/api/jobs/${job.id}/words`)
      .then((r) => r.json())
      .then((d) => setWords(d.words ?? []))
      .catch(() => {});
  };

  const onTime = () => {
    const v = videoRef.current;
    if (!v || !words || !captionsOn) return;
    const t = v.currentTime;
    const w = words.find((x) => t >= x.start && t < x.end);
    setActive(w ? w.word : null);
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Contact sheet — click a frame to seek">
        {frames.map((_, i) => {
          const t = times[i] ?? null;
          return (
            <button
              key={i}
              type="button"
              title={t !== null ? `Seek to ${t.toFixed(1)}s` : `frame ${i + 1}`}
              aria-label={t !== null ? `seek to ${t.toFixed(1)} seconds` : `frame ${i + 1}`}
              onClick={() => {
                const v = videoRef.current;
                if (v && t !== null) v.currentTime = Math.min(t, duration || t);
              }}
              className="shrink-0 rounded-ctl border border-border-subtle bg-surface-2 p-0.5 transition-transform hover:scale-[1.04] hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <img
                src={`/api/jobs/${job.id}/frames/${i}`}
                alt={`contact sheet ${i + 1}`}
                loading="lazy"
                className="h-14 w-24 rounded object-cover"
              />
            </button>
          );
        })}
      </div>
      {/* Render-tier guard: no-stasis verdict per scene from frame diffs. */}
      {(job.motion?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Motion guard">
          <span className="text-[11px] uppercase tracking-wide text-text-low">motion guard</span>
          {job.motion?.map((m) => (
            <span
              key={m.scene}
              title={`scene ${m.scene + 1}: mean frame drift ${m.score} (${m.frames} samples)`}
              className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${
                m.pass
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : "border-warn/40 bg-warn/10 text-warn"
              }`}
            >
              {m.pass ? "✓" : "▲"} S{m.scene + 1} · {m.score.toFixed(2)}
            </span>
          ))}
        </div>
      )}
      {job.sfx && (
        <p className="mt-2 text-[12px] text-text-low">
          SFX bed synthesized (deterministic cue kit) · voice:{" "}
          {hasVoice
            ? `${job.voice?.tier ?? "AI-OK"} · ${job.voice?.words} words`
            : job.voice?.error
              ? `skipped (${job.voice.error})`
              : "off"}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {ratios.length > 1 && (
          <div className="flex gap-1.5" role="group" aria-label="Video ratio">
            {ratios.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={ratio === r}
                onClick={() => setRatio(ratio === r ? null : r)}
                className={`rounded-full border px-2 py-0.5 text-[12px] transition-colors ${
                  ratio === r
                    ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                    : "border-border-subtle text-text-med hover:text-text-hi"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <video
          ref={videoRef}
          src={`/api/jobs/${job.id}/video${ratio ? `?ratio=${encodeURIComponent(ratio)}` : ""}`}
          controls
          preload="metadata"
          poster={job.thumbnailPath ? `/api/jobs/${job.id}/thumbnail${ratio ? `?ratio=${encodeURIComponent(ratio)}` : ""}` : undefined}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={onTime}
          className="h-24 w-40 rounded-ctl border border-border-subtle bg-surface-2"
        />
        {hasVoice && (
          <label className="flex items-center gap-2 text-[13px] text-text-med">
            <input
              type="checkbox"
              checked={captionsOn}
              onChange={(e) => {
                setCaptionsOn(e.target.checked);
                if (e.target.checked) loadWords();
              }}
              className="size-4 accent-[var(--accent)]"
            />
            Active-word captions
            {captionsOn && active && (
              <span className="rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 text-[12px] font-medium text-accent-strong">
                {active}
              </span>
            )}
          </label>
        )}
        {hasVoice && (
          <a
            href={`/api/jobs/${job.id}/captions`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-text-med underline underline-offset-2 hover:text-text-hi"
          >
            WebVTT
          </a>
        )}
        {job.segments && (
          <span className="text-[12px] tabular-nums text-text-low">
            {job.segments.length} segments
          </span>
        )}
      </div>
    </div>
  );
}

function RetryButton({ job, onQueued }: { job: Job; onQueued: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = async () => {
    if (!job.storyboardId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storyboardId: job.storyboardId,
          seed: job.seed,
          sceneIndex: job.kind === "segment" ? job.sceneIndex : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "retry failed");
      }
      onQueued();
    } catch (e) {
      setError(e instanceof Error ? e.message : "retry failed");
    } finally {
      setBusy(false);
    }
  };
  if (!job.storyboardId) return null;
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={retry} disabled={busy}>
        {busy ? "Queuing…" : "Retry — same seed"}
      </Button>
      {job.seed && <span className="text-[11px] tabular-nums text-text-low">seed {job.seed}</span>}
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const tickFn = async () => {
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
    tickFn();
    const iv = setInterval(tickFn, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [tick]);

  const active = jobs.some((j) => j.status === "running" || j.status === "queued");

  return (
    <AppShell projectTitle="Jobs">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
          Render queue {active && <span className="animate-pulse text-accent">· live</span>}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-[14px] text-text-med">
          Polls automatically while a job is active. Failed jobs auto-refund their credits; retry
          keeps the same seed family.
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
                    {j.kind === "segment" && (
                      <span
                        className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong"
                        title="Zero-gap: only this scene re-rendered; the rest came from the segment cache"
                      >
                        segment · scene {j.sceneIndex !== undefined ? j.sceneIndex + 1 : "?"}
                      </span>
                    )}
                    {j.quality && (
                      <span className="rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] capitalize text-text-med">
                        {j.quality}
                      </span>
                    )}
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
                {j.status === "failed" && (
                  <RetryButton job={j} onQueued={() => setTick((t) => t + 1)} />
                )}
              </div>
              {j.status === "done" && <Filmstrip job={j} />}
              {(j.status === "failed" || j.status === "done") && <LogViewer jobId={j.id} />}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
