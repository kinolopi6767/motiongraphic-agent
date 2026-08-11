import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { credit } from "@/lib/ledger.mjs";

export const runtime = "nodejs";

const JOB_STORE = join(process.cwd(), "data", "jobs");

type Params = { params: Promise<{ id: string }> };

/**
 * Cancel a queued or running job: drops a marker the worker polls, marks the
 * job cancelled and refunds the credits immediately (Flow D refund points).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^job-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const jobFile = join(JOB_STORE, `${id}.json`);
  let job: { status?: string; cost?: number; refunded?: boolean; error?: string; finishedAt?: string; createdAt?: string };
  try {
    job = JSON.parse(await readFile(jobFile, "utf8"));
  } catch {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  if (job.status !== "queued" && job.status !== "running") {
    return NextResponse.json({ error: `job is ${job.status} — nothing to cancel` }, { status: 400 });
  }
  // marker first so the worker (if running) kills its pipeline ASAP
  await writeFile(join(JOB_STORE, `${id}.cancel`), new Date().toISOString());
  let refundedAmount = 0;
  if (job.cost && !job.refunded) {
    await credit(job.cost, `cancel:${id}`);
    refundedAmount = job.cost;
  }
  job.status = "cancelled";
  job.refunded = Boolean(refundedAmount);
  job.error = "cancelled by user";
  job.finishedAt = new Date().toISOString();
  await writeFile(jobFile, JSON.stringify(job, null, 2));
  return NextResponse.json({ ok: true, status: "cancelled", refunded: refundedAmount });
}
