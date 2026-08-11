import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const STORE = join(process.cwd(), "data", "storyboards");

type Params = { params: Promise<{ id: string }> };

/** Clone a storyboard into a new variant (Flow B step 5 — "Make variant"). */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^sb-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  let record: Record<string, unknown>;
  try {
    record = JSON.parse(await readFile(join(STORE, `${id}.json`), "utf8"));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const newId = `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const clone = {
    ...record,
    id: newId,
    clonedFrom: id,
    createdAt: new Date().toISOString(),
  };
  await mkdir(STORE, { recursive: true });
  await writeFile(join(STORE, `${newId}.json`), JSON.stringify(clone, null, 2));
  return NextResponse.json({ id: newId }, { status: 201 });
}
