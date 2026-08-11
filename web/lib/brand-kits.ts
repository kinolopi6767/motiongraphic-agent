export type BrandVibe = "curious" | "crisp" | "energetic" | "calm";

export type BrandKit = {
  id: string;
  name: string;
  colors: string[];
  vibe: BrandVibe;
  createdAt: string;
  updatedAt?: string;
};

export const VIBES: BrandVibe[] = ["curious", "crisp", "energetic", "calm"];
export const MAX_COLORS = 4;

/** WCAG relative luminance of a #rrggbb hex color. */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return -1;
  const [r, g, b] = m[1].match(/.{2}/g)!.map((h) => parseInt(h, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 1.4.3 contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la < 0 || lb < 0) return -1;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ColorCheck = {
  color: string;
  vsWhite: number; // contrast against white text
  whiteOk: boolean; // >= 4.5 (AA body)
  onCanvas: number; // contrast against the kit canvas
  canvasOk: boolean; // >= 3 (AA UI / large)
};

export const DEFAULT_CANVAS = "#0B0E13";

/** Live per-color WCAG checks — drives the wizard chips (UI-PLAN Flow A). */
export function kitChecks(colors: string[], canvas: string = DEFAULT_CANVAS): ColorCheck[] {
  return colors.map((color) => {
    const vsWhite = contrastRatio(color, "#FFFFFF");
    const onCanvas = contrastRatio(color, canvas);
    return {
      color,
      vsWhite,
      whiteOk: vsWhite >= 4.5,
      onCanvas,
      canvasOk: onCanvas >= 3,
    };
  });
}

export function isColor(hex: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(hex.trim());
}

export async function listKits(): Promise<BrandKit[]> {
  const { mkdir, readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "data", "brand-kits");
  await mkdir(dir, { recursive: true });
  const out: BrandKit[] = [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    try {
      out.push(JSON.parse(await readFile(join(dir, f), "utf8")));
    } catch {}
  }
  return out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function writeKit(kit: BrandKit): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "data", "brand-kits");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${kit.id}.json`), JSON.stringify(kit, null, 2));
}

export async function readKit(id: string): Promise<BrandKit | null> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (!/^kit-[a-z0-9-]+$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(join(process.cwd(), "data", "brand-kits", `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}
