import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const JOB_STORE = join(process.cwd(), "data", "jobs");

type Params = { params: Promise<{ id: string }> };

/** Word timestamps for a done job (active-word captions, Phase 4). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^job-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const job = JSON.parse(await readFile(join(JOB_STORE, `${id}.json`), "utf8"));
    const wordsPath = job.voice?.wordsFile;
    if (!wordsPath || typeof wordsPath !== "string") {
      return NextResponse.json({ error: "no words for this job" }, { status: 404 });
    }
    const words = JSON.parse(await readFile(wordsPath, "utf8"));
    return NextResponse.json({ words });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
