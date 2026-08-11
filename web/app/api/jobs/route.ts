import { NextRequest, NextResponse } from "next/server";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

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
  error?: string;
  videoPath?: string;
  logFile?: string;
  createdAt: string;
  finishedAt?: string;
};

export async function POST(req: NextRequest) {
  let body: { storyboardId?: string };
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
  try {
    await readFile(recordPath, "utf8");
  } catch {
    return NextResponse.json({ error: "storyboard not found" }, { status: 404 });
  }

  await mkdir(JOB_STORE, { recursive: true });
  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const jobFile = join(JOB_STORE, `${jobId}.json`);
  const record: JobRecord = { id: jobId, storyboardId, status: "queued", createdAt: new Date().toISOString() };
  await writeFile(jobFile, JSON.stringify(record, null, 2));

  const child = spawn("node", [JOB_RUNNER, recordPath, jobId, jobFile], {
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  return NextResponse.json({ id: jobId, status: "queued" }, { status: 202 });
}

export async function GET() {
  await mkdir(JOB_STORE, { recursive: true });
  const files = (await readdir(JOB_STORE)).filter((f) => f.endsWith(".json") && !f.includes(".storyboard."));
  const jobs: JobRecord[] = [];
  for (const f of files) {
    try {
      jobs.push(JSON.parse(await readFile(join(JOB_STORE, f), "utf8")) as JobRecord);
    } catch {}
  }
  jobs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ jobs });
}