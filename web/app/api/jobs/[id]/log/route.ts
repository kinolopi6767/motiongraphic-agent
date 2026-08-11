import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const JOB_STORE = join(process.cwd(), "data", "jobs");

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^job-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  let logFile: string | undefined;
  try {
    logFile = JSON.parse(await readFile(join(JOB_STORE, `${id}.json`), "utf8")).logFile;
  } catch {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  if (!logFile) return NextResponse.json({ error: "no log yet" }, { status: 404 });
  try {
    const log = await readFile(logFile, "utf8");
    return new NextResponse(log, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "log file missing" }, { status: 404 });
  }
}