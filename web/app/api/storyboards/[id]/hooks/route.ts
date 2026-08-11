import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runHooks } from "@/lib/director";
import { HookOption, Storyboard, StoryboardScene } from "@/lib/storyboard";

export const runtime = "nodejs";
export const maxDuration = 60;

const STORE = join(process.cwd(), "data", "storyboards");

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^sb-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { index?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.index !== "number" || body.index < 0) {
    return NextResponse.json({ error: "scene index required" }, { status: 400 });
  }

  const path = join(STORE, `${id}.json`);
  let record: { storyboard: Storyboard; hooks?: Record<string, HookOption[]> };
  try {
    record = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const scene: StoryboardScene | undefined = record.storyboard.scenes[body.index];
  if (!scene) return NextResponse.json({ error: "scene index out of range" }, { status: 400 });

  if (record.hooks?.[body.index]) {
    return NextResponse.json({ options: record.hooks[body.index] });
  }

  try {
    const options = await runHooks(scene);
    if (!record.hooks) record.hooks = {};
    record.hooks[body.index] = options;
    await writeFile(path, JSON.stringify(record, null, 2));
    return NextResponse.json({ options });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "hook engineer failed" }, { status: 502 });
  }
}