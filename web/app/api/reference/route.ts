import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzeMotionProfile } from "@/lib/motion-profile";

export const runtime = "nodejs";
export const maxDuration = 180;

const REFS_DIR = join(process.cwd(), "data", "references");

/** Upload a reference video → sample frames → vision analysis → motion profile. */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form-data" }, { status: 400 });
  }
  const file = form.get("video");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "video file required (field: video)" }, { status: 400 });
  }
  if (file.size > 150 * 1024 * 1024) {
    return NextResponse.json({ error: "video must be under 150MB" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  await mkdir(REFS_DIR, { recursive: true });
  const videoPath = join(REFS_DIR, `upload-${Date.now()}.mp4`);
  await writeFile(videoPath, buf);
  try {
    const { id, profile, usage } = await analyzeMotionProfile(videoPath);
    return NextResponse.json({ id, profile, usage });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 502 });
  }
}
