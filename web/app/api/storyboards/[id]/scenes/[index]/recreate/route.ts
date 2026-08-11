import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chatJsonU } from "@/lib/zen";
import { Storyboard, StoryboardScene, validateStoryboard, validateSceneValues } from "@/lib/storyboard";

export const runtime = "nodejs";
export const maxDuration = 120;

const STORE = join(process.cwd(), "data", "storyboards");

type Params = { params: Promise<{ id: string; index: string }> };

const REWRITE_SYSTEM = `You are the SCENE AGENT of an agentic motion-graphics engine.
Rewrite ONE scene of an approved storyboard into a new, better version.
Rules:
- Keep the verb or switch to a better one from: count-up, chart-race, kinetic-title, pipeline-flow.
- Keep the scene duration exactly as given.
- Keep all factual claims faithful to the script. Never invent data.
- Values must follow the verb contract:
  - count-up:       {value:number, label:string, suffix?, prefix?, accent?}
  - chart-race:     {title:string, items:[{label,value,color?}], accent?}
  - kinetic-title:  {lines:string[], accent?, accentOn?:number, kicker?}
  - pipeline-flow:  {title:string, nodes:[{label,color?}], accent?}
- If the user gives an instruction, apply it. Otherwise make the scene clearly
  better: sharper hook/microhook, punchier wording, stronger visual hierarchy.
Return ONLY valid JSON: {"scene":{verb,duration,values,hook?,microhook?,tone?}}.`;

/** Recreate a single scene with the scene agent (agentic edit, Flow C). */
export async function POST(req: NextRequest, { params }: Params) {
  const { id, index } = await params;
  if (!/^sb-[a-z0-9-]+$/.test(id) || !/^\d+$/.test(index)) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const idx = Number(index);
  let body: { instruction?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const path = join(STORE, `${id}.json`);
  let record: {
    brief: string;
    storyboard: Storyboard;
    usage?: { at: string; kind: string; model: string; prompt: number; completion: number; total: number }[];
  };
  try {
    record = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const scene = record.storyboard.scenes[idx];
  if (!scene) return NextResponse.json({ error: "scene index out of range" }, { status: 400 });

  const userMsg = {
    script: record.brief,
    currentScene: scene,
    instruction: typeof body.instruction === "string" && body.instruction.trim() ? body.instruction.trim() : "Make this scene clearly better.",
  };

  let rewritten: StoryboardScene | null = null;
  let lastErr: unknown;
  let usage = { model: "unknown", prompt: 0, completion: 0, total: 0 };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { json, usage: u } = await chatJsonU<{ scene?: StoryboardScene }>(REWRITE_SYSTEM, JSON.stringify(userMsg), 0.6);
      usage = u;
      const s = json.scene;
      if (!s || typeof s !== "object") throw new Error("scene agent returned no scene");
      const errors = validateSceneValues(s.verb, s.values ?? {});
      if (errors.length) throw new Error(`values invalid: ${errors.join("; ")}`);
      s.duration = scene.duration;
      // carry the style colors forward so the new scene matches the video look
      s.values.bg = scene.values.bg ?? record.storyboard.scenes[idx].values.bg;
      s.values.textColor = scene.values.textColor ?? record.storyboard.scenes[idx].values.textColor;
      record.storyboard.scenes[idx] = s;
      const sbErrors = validateStoryboard(record.storyboard);
      if (sbErrors.length) throw new Error(`storyboard invalid: ${sbErrors.join("; ")}`);
      rewritten = s;
      break;
    } catch (e) {
      lastErr = e;
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
  }
  if (!rewritten) {
    return NextResponse.json({ error: lastErr instanceof Error ? lastErr.message : "scene agent failed" }, { status: 502 });
  }

  record.storyboard.total = record.storyboard.scenes.reduce((a, s) => a + s.duration, 0);
  record.usage = [
    ...(record.usage ?? []),
    { at: new Date().toISOString(), kind: `scene-rewrite:${idx}`, ...usage },
  ];
  await writeFile(path, JSON.stringify(record, null, 2));
  return NextResponse.json({ scene: rewritten, usage });
}
