import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const runtime = "nodejs";

const JOB_STORE = join(process.cwd(), "data", "jobs");

type Params = { params: Promise<{ id: string; i: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, i } = await params;
  if (!/^job-[a-z0-9-]+$/.test(id) || !/^\d+$/.test(i)) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  try {
    const job = JSON.parse(await readFile(join(JOB_STORE, `${id}.json`), "utf8"));
    const frame = (job.frames ?? [])[Number(i)];
    if (!frame || typeof frame !== "string") {
      return NextResponse.json({ error: "no frame" }, { status: 404 });
    }
    const root = resolve(process.cwd(), "..");
    const path = resolve(frame);
    if (!path.startsWith(root)) {
      return NextResponse.json({ error: "outside workspace" }, { status: 400 });
    }
    const buf = await readFile(path);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
