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
- VARIETY RULES (non-negotiable): use at least 2 different verbs when there are
  3+ scenes; never use the same verb more than twice in the whole video; never
  place the same verb in adjacent scenes. Alternate kinetic-title with data
  verbs (count-up / chart-race / timeline / radial-gauge / pipeline-flow).
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
- timeline:       {title:string, events:[{label,value?,color?}], accent?}
- radial-gauge:   {value:number, label:string, unit?, accent?}

MOTION RECIPE (optional values.recipe — pick the shot that fits the beat):
- count-up:      "confetti" (sprint count + celebration burst — for records,
                 launches, wins) or "roll" (odometer roll — for steady growth)
- kinetic-title: "marker" (hand-drawn underline on the accent word — human,
                 editorial) or "slam" (big type slams in — launch energy)
- chart-race:    "live-moves" (bars race and re-rank — competition)
- pipeline-flow: "routing" (data pulses through the pipe — process)
- timeline:      "travel" (the line draws across milestones — journey)
- radial-gauge:  "readout" (the dial fills — completion/score)
Choose the recipe by the beat's emotion, not by default. If unsure, omit it.

storyboard.json fields: title, formatArchetype (case-study|data-explainer|systems-explainer|timeline),
scenes[] each {verb, duration, values, hook?, microhook?, tone?}.
No filler scenes — only what the brief earns.`;

/**
 * Variety guard: no verb more than twice in a row of scenes, no more than 2
 * repeats of one verb, and data-y verbs preferred for factual beats.
 */
function varietyErrors(scenes: Storyboard["scenes"]) {
  const counts: Record<string, number> = {};
  for (const s of scenes) counts[s.verb] = (counts[s.verb] ?? 0) + 1;
  const errs: string[] = [];
  if (scenes.length >= 3 && Object.keys(counts).length < 2) errs.push("use at least 2 different verbs");
  for (const [verb, n] of Object.entries(counts)) {
    if (n > 2) errs.push(`verb "${verb}" used ${n} times — max 2; vary the verbs`);
  }
  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].verb === scenes[i - 1].verb) errs.push(`adjacent scenes ${i} and ${i + 1} repeat "${scenes[i].verb}" — alternate verbs`);
  }
  return errs;
}

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

  let lastErr: Error | null = null;
  let usage = { model: "unknown", prompt: 0, completion: 0, total: 0 };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const retryNote =
        lastErr instanceof Error && attempt === 2
          ? `\n\nYour previous attempt was rejected. Fix ALL of these: ${lastErr.message}`
          : "";
      const { json: sb, usage: u } = await chatJsonU<Storyboard>(
        DIRECTOR_SYSTEM,
        `BRIEF:\n${brief}\n\n${extras}\n\n${VALUES_CONTRACT}${retryNote}`,
      );
      usage = u;
      const errors = validateStoryboard(sb);
      const vErrs = varietyErrors(sb.scenes);
      if (!errors.length && vErrs.length === 0) {
        sb.total = sb.scenes.reduce((a, s) => a + s.duration, 0);
        return { storyboard: sb, usage };
      }
      lastErr = new Error(
        `storyboard invalid: ${[...errors, ...vErrs].join("; ")}`,
      );
      console.error(`[director] retry ${attempt}: ${lastErr.message}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
  }
  throw lastErr ?? new Error("director failed");
}