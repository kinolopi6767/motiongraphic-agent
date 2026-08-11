import { NextRequest, NextResponse } from "next/server";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { costFor, credit, debit } from "@/lib/ledger.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const SB_STORE = join(process.cwd(), "data", "storyboards");
const JOB_STORE = join(process.cwd(), "data", "jobs");
// Built via runtime concatenation so Turbopack doesn't trace it as a module import.
const JOB_RUNNER = [process.cwd(), "lib", ["render-job", ".", "mjs"].join("")].join("/");

type JobRecord = {
  id: string;
  storyboardId?: string;
  status: "queued" | "running" | "done" | "failed";
  stage?: string;
  kind?: "full" | "segment";
  sceneIndex?: number;
  ratios?: string[];
  quality?: string;
  videos?: Record<string, string>;
  thumbnails?: Record<string, string>;
  ratioRuns?: Record<string, string>;
  cost?: number;
  refunded?: boolean;
  error?: string;
  videoPath?: string;
  logFile?: string;
  frames?: string[];
  frameTimes?: (number | null)[];
  motion?: { scene: number; score: number; pass: boolean }[];
  segments?: string[];
  thumbnailPath?: string;
  sfx?: boolean;
  voice?: { tier?: string; words?: number; error?: string } | null;
  seed?: string;
  createdAt: string;
  finishedAt?: string;
};

async function listJobs(): Promise<JobRecord[]> {
  await mkdir(JOB_STORE, { recursive: true });
  const files = (await readdir(JOB_STORE)).filter((f) => f.endsWith(".json") && !f.includes(".storyboard."));
  const jobs: JobRecord[] = [];
  for (const f of files) {
    try {
      jobs.push(JSON.parse(await readFile(join(JOB_STORE, f), "utf8")));
    } catch {}
  }
  jobs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return jobs;
}

const RATIOS = ["16:9", "1:1", "9:16"];
const QUALITIES = ["normal", "medium", "max"] as const;

async function previousDoneJob(storyboardId: string): Promise<JobRecord | null> {
  const jobs = await listJobs();
  const done = jobs
    .filter((j) => j.storyboardId === storyboardId && j.status === "done" && Array.isArray(j.ratios))
    .sort((a, b) => (b.finishedAt || "").localeCompare(a.finishedAt || ""));
  return done[0] ?? null;
}

export async function POST(req: NextRequest) {
  let body: { storyboardId?: string; seed?: string; sceneIndex?: number; ratios?: string[]; quality?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { storyboardId } = body ?? {};
  if (!storyboardId || !/^sb-[a-z0-9-]+$/.test(storyboardId)) {
    return NextResponse.json({ error: "storyboardId required" }, { status: 400 });
  }

  const recordPath = join(SB_STORE, `${storyboardId}.json`);
  let record: { storyboard: { total: number; scenes: { duration: number }[] }; ratio?: string; quality?: string };
  try {
    record = JSON.parse(await readFile(recordPath, "utf8"));
  } catch {
    return NextResponse.json({ error: "storyboard not found" }, { status: 404 });
  }

  // Zero-gap segment re-render (Phase 5): sceneIndex => only that scene renders.
  const sceneIndex =
    typeof body.sceneIndex === "number" &&
    Number.isInteger(body.sceneIndex) &&
    body.sceneIndex >= 0 &&
    body.sceneIndex < (record.storyboard.scenes?.length ?? 0)
      ? body.sceneIndex
      : undefined;
  const kind = sceneIndex !== undefined ? "segment" : "full";

  // Ratios to render; segment jobs inherit the previous done render's ratios.
  const requestedRatios =
    Array.isArray(body.ratios) && body.ratios.length > 0
      ? body.ratios.filter((r): r is string => RATIOS.includes(r as string))
      : [];
  let ratios = requestedRatios.length > 0
    ? requestedRatios
    : record.ratio && RATIOS.includes(record.ratio)
      ? [record.ratio]
      : ["16:9"];
  if (kind === "segment") {
    const prev = await previousDoneJob(storyboardId);
    ratios = prev?.ratios?.length ? prev.ratios : ratios;
  }

  const billedSeconds = sceneIndex !== undefined
    ? record.storyboard.scenes[sceneIndex].duration
    : (record.storyboard?.total ?? 8);

  const quality = QUALITIES.includes(body.quality as (typeof QUALITIES)[number])
    ? (body.quality as (typeof QUALITIES)[number])
    : (record.quality as (typeof QUALITIES)[number] | undefined) ?? "max";

  // Cost gate (Flow D): deduct BEFORE enqueue, refund on failure (swept in GET).
  const cost = costFor(billedSeconds) * ratios.length;
  try {
    await debit(cost, `job-queue:${storyboardId}${sceneIndex !== undefined ? `:scene${sceneIndex}` : ""}`);
  } catch (e) {
    const insufficient =
      e instanceof Error && "code" in e && (e as Error & { code?: string }).code === "INSUFFICIENT";
    if (insufficient) return NextResponse.json({ error: e.message }, { status: 402 });
    throw e;
  }

  await mkdir(JOB_STORE, { recursive: true });
  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const jobFile = join(JOB_STORE, `${jobId}.json`);
  const seed =
    typeof body.seed === "string" && /^[a-z0-9]{4,16}$/.test(body.seed) ? body.seed : null;
  const finalSeed = seed ?? Math.random().toString(36).slice(2, 8);
  const job: JobRecord = {
    id: jobId,
    storyboardId,
    status: "queued",
    stage: "queued",
    kind,
    sceneIndex,
    ratios,
    quality,
    cost,
    seed: finalSeed,
    createdAt: new Date().toISOString(),
  };
  await writeFile(jobFile, JSON.stringify(job, null, 2));

  const child = spawn(
    "node",
    [JOB_RUNNER, recordPath, jobId, jobFile, "", finalSeed, kind, sceneIndex !== undefined ? String(sceneIndex) : "", ratios.join(","), quality],
    {
      stdio: "ignore",
      detached: true,
    }
  );
  child.unref();

  return NextResponse.json({ id: jobId, status: "queued", cost, kind, sceneIndex, ratios, quality }, { status: 202 });
}

export async function GET() {
  const jobs = await listJobs();
  // Refund sweep: failed jobs get their credits back exactly once.
  let swept = 0;
  for (const j of jobs) {
    if (j.status === "failed" && !j.refunded && j.cost) {
      await credit(j.cost, `refund:${j.id}`);
      j.refunded = true;
      await writeFile(join(JOB_STORE, `${j.id}.json`), JSON.stringify(j, null, 2));
      swept++;
    }
  }
  if (swept) jobs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ jobs, refunded: swept });
}