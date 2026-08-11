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
  cost?: number;
  refunded?: boolean;
  error?: string;
  videoPath?: string;
  logFile?: string;
  frames?: string[];
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

export async function POST(req: NextRequest) {
  let body: { storyboardId?: string; seed?: string };
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
  let record: { storyboard: { total: number } };
  try {
    record = JSON.parse(await readFile(recordPath, "utf8"));
  } catch {
    return NextResponse.json({ error: "storyboard not found" }, { status: 404 });
  }

  // Cost gate (Flow D): deduct BEFORE enqueue, refund on failure (swept in GET).
  const cost = costFor(record.storyboard?.total ?? 8);
  try {
    await debit(cost, `job-queue:${storyboardId}`);
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
    cost,
    seed: finalSeed,
    createdAt: new Date().toISOString(),
  };
  await writeFile(jobFile, JSON.stringify(job, null, 2));

  const child = spawn("node", [JOB_RUNNER, recordPath, jobId, jobFile, "", finalSeed], {
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  return NextResponse.json({ id: jobId, status: "queued", cost }, { status: 202 });
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