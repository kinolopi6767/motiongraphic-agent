/** Storyboard contract shared by API + UI (mirror of src/schema.mjs). */

export const VERBS = ["count-up", "chart-race", "kinetic-title", "pipeline-flow"] as const;
export type Verb = (typeof VERBS)[number];

export interface SceneValues {
  [key: string]: unknown;
}

export interface StoryboardScene {
  verb: Verb;
  duration: number;
  values: SceneValues;
  hook?: string;
  microhook?: string;
  tone?: string;
}

export interface Storyboard {
  title: string;
  formatArchetype: string;
  scenes: StoryboardScene[];
  total: number;
}

export const TIMING = { MIN_SCENE_S: 4, MAX_SCENE_S: 12, MIN_TOTAL_S: 8, MAX_TOTAL_S: 90 };

export function validateStoryboard(sb: unknown): string[] {
  const errors: string[] = [];
  if (!sb || typeof sb !== "object") return ["storyboard is not an object"];
  const s = sb as Storyboard;
  if (!s.title || typeof s.title !== "string" || !s.title.trim()) errors.push("title missing");
  if (!Array.isArray(s.scenes) || s.scenes.length === 0) errors.push("scenes must be a non-empty array");
  s.scenes?.forEach((sc, i) => {
    if (!sc) return errors.push(`scene ${i}: null`);
    if (!VERBS.includes(sc.verb)) errors.push(`scene ${i}: unknown verb "${sc.verb}"`);
    if (typeof sc.duration !== "number" || sc.duration < TIMING.MIN_SCENE_S || sc.duration > TIMING.MAX_SCENE_S)
      errors.push(`scene ${i}: duration ${sc.duration} out of range`);
    if (!sc.values || typeof sc.values !== "object") errors.push(`scene ${i}: values missing`);
  });
  const total = s.scenes?.reduce((a, x) => a + (x.duration || 0), 0) ?? 0;
  if (total < TIMING.MIN_TOTAL_S || total > TIMING.MAX_TOTAL_S) errors.push(`total ${total}s out of range`);
  return errors;
}

export function sceneSummary(scene: StoryboardScene): string {
  const v = scene.values ?? {};
  switch (scene.verb) {
    case "count-up":
      return String(v.label ?? v.value ?? "number");
    case "chart-race":
      return String(v.title ?? "chart");
    case "kinetic-title":
      return (Array.isArray(v.lines) ? (v.lines as string[])[0] : "") || "headline";
    case "pipeline-flow":
      return String(v.title ?? "pipeline");
  }
}

export function sceneBadge(scene: StoryboardScene): string {
  switch (scene.verb) {
    case "count-up":
      return "STAT";
    case "chart-race":
      return "CHART";
    case "kinetic-title":
      return "TITLE";
    case "pipeline-flow":
      return "FLOW";
  }
}

/** Per-verb values contract (mirror of src/schema.mjs) — the scene agents' gate. */
export function validateSceneValues(verb: Verb, values: SceneValues): string[] {
  const errors: string[] = [];
  if (!values || typeof values !== "object") return ["values missing"];
  switch (verb) {
    case "count-up":
      if (typeof values.value !== "number") errors.push("count-up: value must be a number");
      if (!values.label || typeof values.label !== "string") errors.push("count-up: label required");
      break;
    case "chart-race":
      if (!Array.isArray(values.items) || (values.items as unknown[]).length < 2 || (values.items as unknown[]).length > 6)
        errors.push("chart-race: items must be an array of 2-6");
      (values.items as Array<{ label?: string; value?: number }> | undefined)?.forEach((it, i) => {
        if (!it || typeof it.value !== "number" || !it.label) errors.push(`chart-race: item ${i} needs label+value`);
      });
      if (typeof values.title !== "string" || !values.title) errors.push("chart-race: title required");
      break;
    case "kinetic-title":
      if (!Array.isArray(values.lines) || (values.lines as unknown[]).length < 1 || (values.lines as unknown[]).length > 3)
        errors.push("kinetic-title: lines must be 1-3");
      if (
        values.accentOn !== undefined &&
        (typeof values.accentOn !== "number" || values.accentOn < 0 || values.accentOn > ((values.lines as unknown[]).length || 1) - 1)
      )
        errors.push("kinetic-title: accentOn out of range");
      break;
    case "pipeline-flow":
      if (!Array.isArray(values.nodes) || (values.nodes as unknown[]).length < 2 || (values.nodes as unknown[]).length > 6)
        errors.push("pipeline-flow: nodes must be 2-6");
      if (typeof values.title !== "string" || !values.title) errors.push("pipeline-flow: title required");
      break;
    default:
      errors.push(`unknown verb ${verb}`);
  }
  return errors;
}