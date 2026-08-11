import { NextRequest, NextResponse } from "next/server";
import { BrandVibe, MAX_COLORS, VIBES, isColor, readKit, writeKit } from "@/lib/brand-kits";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kit = await readKit(id);
  if (!kit) return NextResponse.json({ error: "kit not found" }, { status: 404 });
  let body: { name?: unknown; colors?: unknown; vibe?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 40) {
      return NextResponse.json({ error: "kit name must be 2–40 characters" }, { status: 400 });
    }
    kit.name = name;
  }
  if (body.colors !== undefined) {
    const colors = (body.colors as unknown[]).map(String);
    if (colors.length < 2 || colors.length > MAX_COLORS || colors.some((c) => !isColor(c))) {
      return NextResponse.json({ error: `colors must be 2–${MAX_COLORS} valid hex values` }, { status: 400 });
    }
    kit.colors = colors;
  }
  if (body.vibe !== undefined) {
    const vibe = body.vibe as BrandVibe;
    if (!VIBES.includes(vibe)) {
      return NextResponse.json({ error: `vibe must be one of ${VIBES.join(", ")}` }, { status: 400 });
    }
    kit.vibe = vibe;
  }
  kit.updatedAt = new Date().toISOString();
  await writeKit(kit);
  return NextResponse.json({ kit });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { unlink } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (!/^kit-[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    await unlink(join(process.cwd(), "data", "brand-kits", `${id}.json`));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "kit not found" }, { status: 404 });
  }
}
