import { NextRequest, NextResponse } from "next/server";
import { BrandVibe, MAX_COLORS, VIBES, isColor, listKits, writeKit } from "@/lib/brand-kits";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ kits: await listKits() });
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; colors?: unknown; vibe?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const colors = Array.isArray(body.colors) ? (body.colors as unknown[]).map(String) : [];
  const vibe = body.vibe as BrandVibe;
  if (name.length < 2 || name.length > 40) {
    return NextResponse.json({ error: "kit name must be 2–40 characters" }, { status: 400 });
  }
  if (colors.length < 2 || colors.length > MAX_COLORS) {
    return NextResponse.json({ error: `kit needs 2–${MAX_COLORS} colors` }, { status: 400 });
  }
  if (colors.some((c) => !isColor(c))) {
    return NextResponse.json({ error: "colors must be #rrggbb hex" }, { status: 400 });
  }
  if (!VIBES.includes(vibe)) {
    return NextResponse.json({ error: `vibe must be one of ${VIBES.join(", ")}` }, { status: 400 });
  }
  const kit = {
    id: `kit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    colors,
    vibe,
    createdAt: new Date().toISOString(),
  };
  await writeKit(kit);
  return NextResponse.json({ kit }, { status: 201 });
}
