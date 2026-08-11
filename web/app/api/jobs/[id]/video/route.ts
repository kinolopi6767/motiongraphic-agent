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
  let videoPath: string | undefined;
  try {
    videoPath = JSON.parse(await readFile(join(JOB_STORE, `${id}.json`), "utf8")).videoPath;
  } catch {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  if (!videoPath) return NextResponse.json({ error: "no video yet" }, { status: 404 });
  try {
    const buf = await readFile(videoPath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(buf.byteLength),
        "content-disposition": `inline; filename="${id}.mp4"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "video file missing" }, { status: 404 });
  }
}