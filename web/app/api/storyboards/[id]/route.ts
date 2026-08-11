import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  Storyboard,
  TIMING,
  validateSceneValues,
} from "@/lib/storyboard";

export const runtime = "nodejs";

const STORE = join(process.cwd(), "data", "storyboards");

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^sb-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const raw = await readFile(join(STORE, `${id}.json`), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

/** Scene edits: duration and/or values, validated against the verb contract. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^sb-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { index?: number; scene?: { duration?: number; values?: Record<string, unknown> } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.index !== "number" || body.index < 0) {
    return NextResponse.json({ error: "scene index required" }, { status: 400 });
  }

  const path = join(STORE, `${id}.json`);
  let record: { storyboard: Storyboard };
  try {
    record = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const scene = record.storyboard.scenes[body.index];
  if (!scene) return NextResponse.json({ error: "scene index out of range" }, { status: 400 });

  const errors: string[] = [];
  const { duration, values } = body.scene ?? {};
  if (duration !== undefined) {
    if (typeof duration !== "number" || duration < TIMING.MIN_SCENE_S || duration > TIMING.MAX_SCENE_S)
      errors.push(`duration must be ${TIMING.MIN_SCENE_S}-${TIMING.MAX_SCENE_S}s`);
    else scene.duration = duration;
  }
  if (values !== undefined) {
    errors.push(...validateSceneValues(scene.verb, values));
    if (!errors.length) scene.values = values;
  }
  if (errors.length) return NextResponse.json({ error: errors.join("; ") }, { status: 400 });

  record.storyboard.total = record.storyboard.scenes.reduce((a, s) => a + s.duration, 0);
  await writeFile(path, JSON.stringify(record, null, 2));
  return NextResponse.json({ scene, total: record.storyboard.total });
}