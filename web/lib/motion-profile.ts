import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { chatVision } from "@/lib/zen";

export type MotionProfile = {
  palette: string[];
  typography: string;
  composition: string;
  motionLanguage: string[];
  transitions: string;
  pacing: "fast" | "medium" | "slow";
  sceneArchetypes: string[];
  summary: string;
};

const PROFILES_DIR = join(process.cwd(), "data", "references");

const FF = join(resolve(process.cwd(), ".."), ".tools", "ffmpeg");
const FFPROBE = join(resolve(process.cwd(), ".."), ".tools", "ffprobe");

/** Sample N evenly spaced frames as small JPEGs for the vision pass. */
export async function sampleFrames(videoPath: string, n = 6): Promise<{ data: Buffer; mime: string }[]> {
  const probe = execFileSync(FFPROBE, ["-v", "error", "-i", videoPath, "-show_entries", "format=duration", "-of", "csv=p=0"], { encoding: "utf8" });
  const duration = Number(probe.trim()) || 10;
  const step = Math.max(0.5, duration / (n + 1));
  const frames: { data: Buffer; mime: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const at = Math.min(duration - 0.1, i * step);
    const buf = execFileSync(
      FF,
      ["-v", "error", "-ss", String(at), "-i", videoPath, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", "-f", "image2", "-"],
    );
    frames.push({ data: buf, mime: "image/jpeg" });
  }
  return frames;
}

const VISION_SYSTEM = `You are a MOTION-DESIGN ANALYST. You are shown frames from a
reference video. Extract its visual language into a structured profile that a
motion-graphics engine can replicate. Be concrete, not vague.`;

const VISION_PROMPT = `Analyze these frames of the reference video and return ONLY valid JSON:
{
  "palette": ["#hex", ...] 2-5 dominant colors, background first,
  "typography": "type style: weights, sizes, case, letter-spacing, font mood",
  "composition": "layout logic: centering, asymmetry, margins, grid, negative space",
  "motionLanguage": ["2-5 concrete motion signatures observed or implied: e.g. staggered text rise, camera push-in, element float, wipe reveals"],
  "transitions": "how cuts/scene changes feel: hard, wipe, flash, morph, zoom",
  "pacing": "fast|medium|slow",
  "sceneArchetypes": ["what kinds of scenes/shots appear: e.g. title card, stat reveal, product scan, diagram build"],
  "summary": "two sentences capturing the overall style a viewer would recognize"
}`;

/** Analyze a reference video into a MotionProfile. */
export async function analyzeMotionProfile(videoPath: string): Promise<{ id: string; profile: MotionProfile; usage: unknown }> {
  const frames = await sampleFrames(videoPath, 6);
  const { json, usage } = await chatVision<MotionProfile>(VISION_SYSTEM, VISION_PROMPT, frames);
  const profile: MotionProfile = {
    palette: (Array.isArray(json.palette) ? json.palette : []).map((c) => String(c)).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5),
    typography: String(json.typography ?? ""),
    composition: String(json.composition ?? ""),
    motionLanguage: (Array.isArray(json.motionLanguage) ? json.motionLanguage : []).map((m) => String(m)).slice(0, 5),
    transitions: String(json.transitions ?? ""),
    pacing: ["fast", "medium", "slow"].includes(json.pacing as string) ? (json.pacing as MotionProfile["pacing"]) : "medium",
    sceneArchetypes: (Array.isArray(json.sceneArchetypes) ? json.sceneArchetypes : []).map((a) => String(a)).slice(0, 6),
    summary: String(json.summary ?? ""),
  };
  const id = `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await mkdir(PROFILES_DIR, { recursive: true });
  await writeFile(join(PROFILES_DIR, `${id}.json`), JSON.stringify({ id, profile, createdAt: new Date().toISOString() }, null, 2));
  return { id, profile, usage };
}

export async function readReference(id: string): Promise<MotionProfile | null> {
  if (!/^ref-[a-z0-9-]+$/.test(id)) return null;
  try {
    const d = JSON.parse(await readFile(join(PROFILES_DIR, `${id}.json`), "utf8"));
    return d.profile ?? null;
  } catch {
    return null;
  }
}

/** One-line style brief for the director prompt. */
export function profileToPrompt(profile: MotionProfile): string {
  return [
    `Reference style "${profile.summary.slice(0, 160)}"`,
    profile.palette.length ? `palette: ${profile.palette.join(", ")}` : "",
    profile.typography ? `typography: ${profile.typography.slice(0, 200)}` : "",
    profile.composition ? `composition: ${profile.composition.slice(0, 200)}` : "",
    profile.motionLanguage.length ? `motion signatures: ${profile.motionLanguage.join("; ")}` : "",
    profile.transitions ? `transitions: ${profile.transitions.slice(0, 120)}` : "",
    profile.pacing ? `pacing: ${profile.pacing}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
