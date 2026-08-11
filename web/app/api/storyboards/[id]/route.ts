import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  Storyboard,
  TIMING,
  validateSceneValues,
} from "@/lib/storyboard";

export const runtime = "nodejs";

const STORE = join(process.cwd(), "data", "storyboards");

type Params = { params: Promise<{ id: string }> };

const ID_RE = /^sb-[a-z0-9-]+$/;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const raw = await readFile(join(STORE, `${id}.json`), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    await unlink(join(STORE, `${id}.json`));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

/** Scene edits: duration, values, hook/microhook/tone — validated per contract. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  let body: {
    index?: number;
    scene?: {
      duration?: number;
      values?: Record<string, unknown>;
      hook?: string | null;
      microhook?: string | null;
      tone?: string | null;
    };
  };
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
  const patch = body.scene ?? {};
  if (patch.duration !== undefined) {
    if (typeof patch.duration !== "number" || patch.duration < TIMING.MIN_SCENE_S || patch.duration > TIMING.MAX_SCENE_S)
      errors.push(`duration must be ${TIMING.MIN_SCENE_S}-${TIMING.MAX_SCENE_S}s`);
    else scene.duration = patch.duration;
  }
  if (patch.values !== undefined) {
    errors.push(...validateSceneValues(scene.verb, patch.values));
    if (!errors.length) scene.values = patch.values;
  }
  if (errors.length) return NextResponse.json({ error: errors.join("; ") }, { status: 400 });

  const str = (v: string | null | undefined): string | undefined =>
    v === null || v === undefined || v === "" ? undefined : v;
  if (patch.hook !== undefined) scene.hook = str(patch.hook);
  if (patch.microhook !== undefined) scene.microhook = str(patch.microhook);
  if (patch.tone !== undefined) scene.tone = str(patch.tone);

  record.storyboard.total = record.storyboard.scenes.reduce((a, s) => a + s.duration, 0);
  await writeFile(path, JSON.stringify(record, null, 2));
  return NextResponse.json({ scene, total: record.storyboard.total });
}