import { chatJsonU } from "./zen";
import { HookOption, Storyboard, VERBS, validateStoryboard } from "./storyboard";

const HOOKS_SYSTEM = `You are the HOOK ENGINEER of an agentic motion-graphics engine.
Given a scene, produce exactly 3 DISTINCT hook options that follow the retention
contract: each option = { hook, microhook }. hook = 1 short cold-open line (max 9
words) that opens the scene; microhook = 1 short forward-pull line (max 8 words)
that entices into the next scene. Keep all claims faithful to the given values.
Never fabricate numbers. Return ONLY valid JSON: {"options":[...]}.`;

/** A/B/C hooks — 3 retention variants for a scene (Flow B step 2). */
export async function runHooks(
  scene: Storyboard["scenes"][number],
): Promise<{ options: HookOption[]; usage: { model: string; prompt: number; completion: number; total: number } }> {
  const { json, usage } = await chatJsonU<{ options?: HookOption[] }>(
    HOOKS_SYSTEM,
    JSON.stringify({ verb: scene.verb, values: scene.values, currentHook: scene.hook, currentMicrohook: scene.microhook }),
    0.7,
  );
  const options = (json.options ?? [])
    .filter((o) => o && typeof o.hook === "string" && o.hook.trim().length > 0)
    .slice(0, 3);
  if (options.length < 1) throw new Error("hook engineer produced no options");
  return { options, usage };
}

const DIRECTOR_SYSTEM = `You are the DIRECTOR AGENT of an agentic motion-graphics video engine.
Turn a brief into a storyboard.json. Requirements:
- Scene verbs limited to: ${VERBS.join(", ")}.
- Total 8-90s, each scene 4-12s.
- Retention contract: cold-open/hook energy in scene 1, value bomb at 60-70%,
  a forward-pull microhook at the end of each scene (hook/microhook fields).
- Duration: if the brief states a target duration ("15-second", "X seconds",
  "30s"), honor it exactly — do NOT invent a different total. Only fall back
  to the target-duration instruction if the brief has no stated length.
- All factual values MUST come from the brief. Never invent data.
- Colors: small intentional palette (max 4) with one accent for hierarchy.
- Every scene needs a complete values object for its verb.
Return ONLY valid JSON.`;

const VALUES_CONTRACT = `Verb -> values contracts:
- count-up:       {value:number, label:string, suffix?, prefix?, accent?}
- chart-race:     {title:string, items:[{label,value,color?}], accent?}
- kinetic-title:  {lines:string[], accent?, accentOn?:number, kicker?}
- pipeline-flow:  {title:string, nodes:[{label,color?}], accent?}

storyboard.json fields: title, formatArchetype (case-study|data-explainer|systems-explainer|timeline),
scenes[] each {verb, duration, values, hook?, microhook?, tone?}.
No filler scenes — only what the brief earns.`;

/** Runs the director agent with one validation retry. Returns usage too. */
export async function runDirector(
  brief: string,
  opts?: { duration?: number; tone?: string; ratio?: string; style?: string; brandKit?: { name: string; colors: string[]; vibe: string } },
): Promise<{ storyboard: Storyboard; usage: { model: string; prompt: number; completion: number; total: number } }> {
  const extras = [
    opts?.duration ? `Target duration: ${opts.duration}s.` : "",
    opts?.tone ? `Tone: ${opts.tone}.` : "",
    opts?.ratio ? `Format ratio: ${opts.ratio}.` : "",
    opts?.style
      ? `Visual style: ${opts.style}. Background and text colors are injected automatically — choose accent colors that fit the style's mood.`
      : "",
    opts?.brandKit
      ? `Brand kit "${opts.brandKit.name}" (vibe: ${opts.brandKit.vibe}): palette = ${opts.brandKit.colors.join(", ")}. Use ONLY these colors — first color is the canvas/background, the rest are accents (one dominant accent).`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  let lastErr: unknown;
  let usage = { model: "unknown", prompt: 0, completion: 0, total: 0 };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { json: sb, usage: u } = await chatJsonU<Storyboard>(
        DIRECTOR_SYSTEM,
        `BRIEF:\n${brief}\n\n${extras}\n\n${VALUES_CONTRACT}`,
      );
      usage = u;
      const errors = validateStoryboard(sb);
      if (!errors.length) {
        sb.total = sb.scenes.reduce((a, s) => a + s.duration, 0);
        return { storyboard: sb, usage };
      }
      lastErr = new Error(`storyboard invalid: ${errors.join("; ")}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
  }
  throw lastErr ?? new Error("director failed");
}