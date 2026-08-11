import { chatJson } from "./zen";
import { Storyboard, VERBS, validateStoryboard } from "./storyboard";

const DIRECTOR_SYSTEM = `You are the DIRECTOR AGENT of an agentic motion-graphics video engine.
Turn a brief into a storyboard.json. Requirements:
- Scene verbs limited to: ${VERBS.join(", ")}.
- Total 8-90s, each scene 4-12s.
- Retention contract: cold-open/hook energy in scene 1, value bomb at 60-70%,
  a forward-pull microhook at the end of each scene (hook/microhook fields).
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

/** Runs the director agent with one validation retry. */
export async function runDirector(
  brief: string,
  opts?: { duration?: number; tone?: string; ratio?: string },
): Promise<Storyboard> {
  const extras = [
    opts?.duration ? `Target duration: ${opts.duration}s.` : "",
    opts?.tone ? `Tone: ${opts.tone}.` : "",
    opts?.ratio ? `Format ratio: ${opts.ratio}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const sb = await chatJson<Storyboard>(
        DIRECTOR_SYSTEM,
        `BRIEF:\n${brief}\n\n${extras}\n\n${VALUES_CONTRACT}`,
      );
      const errors = validateStoryboard(sb);
      if (!errors.length) {
        sb.total = sb.scenes.reduce((a, s) => a + s.duration, 0);
        return sb;
      }
      lastErr = new Error(`storyboard invalid: ${errors.join("; ")}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
  }
  throw lastErr ?? new Error("director failed");
}