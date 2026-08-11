import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const runtime = "nodejs";

const JOB_STORE = join(process.cwd(), "data", "jobs");

type Params = { params: Promise<{ id: string }> };

/** Thumbnail.jpg extracted at the value-bomb time (PLAN §4). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^job-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const job = JSON.parse(await readFile(join(JOB_STORE, `${id}.json`), "utf8"));
    const thumbPath = job.thumbnailPath;
    if (!thumbPath || typeof thumbPath !== "string") {
      return NextResponse.json({ error: "no thumbnail" }, { status: 404 });
    }
    const root = resolve(process.cwd(), "..");
    const path = resolve(thumbPath);
    if (!path.startsWith(root)) {
      return NextResponse.json({ error: "outside workspace" }, { status: 400 });
    }
    const buf = await readFile(path);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
