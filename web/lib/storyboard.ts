/** Storyboard contract shared by API + UI (mirror of src/schema.mjs). */

export type HookOption = { hook: string; microhook?: string };

export const VERBS = ["count-up", "chart-race", "kinetic-title", "pipeline-flow", "timeline", "radial-gauge", "scramble", "letters-up", "scan-band"] as const;
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
  approved?: boolean;
}

export interface Storyboard {
  title: string;
  formatArchetype: string;
  scenes: StoryboardScene[];
  total: number;
}

export const TIMING = { MIN_SCENE_S: 4, MAX_SCENE_S: 12, MIN_TOTAL_S: 8, MAX_TOTAL_S: 90 };

/** Visual style presets — baked into every scene's values (bg/textColor). */
export const STYLES = {
  "studio-black": { label: "Studio Black", bg: "#0B0E13", text: "#F2F4F8", accent: "#6366F1", hint: "crisp, high-contrast, indigo accent" },
  neon: { label: "Neon Nights", bg: "#05010F", text: "#E0F2FE", accent: "#22D3EE", hint: "electric cyan + magenta glow on near-black" },
  paper: { label: "Minimal Paper", bg: "#F6F7F9", text: "#1F2430", accent: "#4F46E5", hint: "light paper canvas, dark ink, one accent" },
  luxury: { label: "Luxury Gold", bg: "#0D0B08", text: "#F5E6C4", accent: "#C9A227", hint: "black + gold, premium quiet drama" },
  energetic: { label: "Energetic", bg: "#16040F", text: "#FFEDD5", accent: "#FB923C", hint: "vivid orange → violet, high voltage" },
  nature: { label: "Deep Forest", bg: "#07110C", text: "#A7F3D0", accent: "#34D399", hint: "deep green with fresh emerald light" },
} as const;

export type StyleId = keyof typeof STYLES;
export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

/** Render quality tiers — max = higher bitrate + extra animation layers. */
export const QUALITY = {
  normal: { label: "Normal", crf: 23, maxMotion: false, desc: "Fast render, standard encode." },
  medium: { label: "Medium", crf: 19, maxMotion: false, desc: "Cleaner encode, same motion." },
  max: { label: "Max", crf: 14, maxMotion: true, desc: "Highest bitrate + extra ambient animation layers." },
} as const;

export type QualityId = keyof typeof QUALITY;
export const QUALITY_IDS = Object.keys(QUALITY) as QualityId[];

/** First scene whose start lands in the 60-70% value-bomb band (or -1). */
export function valueBombIndex(scenes: StoryboardScene[], total: number): number {
  let t = 0;
  for (let i = 0; i < scenes.length; i++) {
    const pct = (t / Math.max(total, 1)) * 100;
    if (pct >= 60 && pct <= 70) return i;
    t += scenes[i].duration;
  }
  return -1;
}

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
    case "timeline":
      return String(v.title ?? "timeline");
    case "radial-gauge":
      return String(v.label ?? v.value ?? "gauge");
    case "scramble":
      return (Array.isArray(v.lines) ? (v.lines as string[])[0] : "") || "reveal";
    case "letters-up":
      return (Array.isArray(v.lines) ? (v.lines as string[])[0] : "") || "letters";
    case "scan-band":
      return String(v.wordmark ?? "wordmark");
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
    case "timeline":
      return "TIME";
    case "radial-gauge":
      return "GAUGE";
    case "scramble":
      return "CODE";
    case "letters-up":
      return "LIFT";
    case "scan-band":
      return "SCAN";
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
    case "timeline":
      if (!Array.isArray(values.events) || (values.events as unknown[]).length < 2 || (values.events as unknown[]).length > 6)
        errors.push("timeline: events must be 2-6");
      (values.events as Array<{ label?: string }> | undefined)?.forEach((it, i) => {
        if (!it || !it.label) errors.push(`timeline: event ${i} needs a label`);
      });
      if (typeof values.title !== "string" || !values.title) errors.push("timeline: title required");
      break;
    case "radial-gauge":
      if (typeof values.value !== "number" || values.value < 0 || values.value > 9999)
        errors.push("radial-gauge: value must be a number");
      if (!values.label || typeof values.label !== "string") errors.push("radial-gauge: label required");
      break;
    case "scramble":
      if (!Array.isArray(values.lines) || (values.lines as unknown[]).length < 1 || (values.lines as unknown[]).length > 3)
        errors.push("scramble: lines must be 1-3");
      break;
    case "letters-up":
      if (!Array.isArray(values.lines) || (values.lines as unknown[]).length < 1 || (values.lines as unknown[]).length > 3)
        errors.push("letters-up: lines must be 1-3");
      break;
    case "scan-band":
      if (!values.wordmark || typeof values.wordmark !== "string")
        errors.push("scan-band: wordmark required");
      break;
    default:
      errors.push(`unknown verb ${verb}`);
  }
  return errors;
}

/** Deterministic "why look" annotation — retention role + verb rationale. */
export function sceneAnnotation(
  scene: StoryboardScene,
  index: number,
  totalScenes: number,
  totalSeconds: number,
): { role: string; verb: string; pacing: string } {
  const start = scene.duration * index;
  const pct = (start / Math.max(totalSeconds, 1)) * 100;
  let role: string;
  if (index === 0) role = "Cold-open — earns the watch in the first seconds.";
  else if (index === totalScenes - 1) role = "Closer — stamps the takeaway.";
  else if (pct >= 60 && pct <= 70) role = "Value bomb — the payoff moment lands here.";
  else if (scene.hook) role = "Bridge — carries momentum forward.";
  else role = "Bridge — keeps the story moving.";
  if (scene.microhook) role += " Ends with a forward-pull microhook.";

  const verbRationale: Record<Verb, string> = {
    "count-up": "One number, anchored to the brief — the stat shot.",
    "chart-race": "Ranks the story's quantities — comparative proof.",
    "kinetic-title": "Typography as motion — the headline moment.",
    "pipeline-flow": "Systems view — how the parts connect.",
    timeline: "The journey drawn out — milestones across time.",
    "radial-gauge": "One metric as a living dial — completion, share, score.",
    scramble: "The word resolves through a scramble — attention, decoding, reveal.",
    "letters-up": "Characters rise into place — elegant, editorial typography.",
    "scan-band": "A distortion band scans the wordmark — product-grade, glitchy polish.",
  };

  const pacing = scene.duration > 8 ? "Slow beat — let the data breathe." : "Quick beat — keeps the cut crisp.";
  return { role, verb: verbRationale[scene.verb], pacing };
}

export type GuardCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

/**
 * Delivery guard (PLAN §5, static tier) — cheap pre-render contract checks.
 * Run on the storyboard; motion/no-stasis checks need frames (Phase 3 render tier).
 */
export function runGuard(sb: Storyboard): GuardCheck[] {
  const checks: GuardCheck[] = [];
  const scenes = sb.scenes;
  const coverage = scenes.filter((s) => s.microhook).length / Math.max(scenes.length - 1, 1);
  const bomb = valueBombIndex(scenes, sb.total);

  checks.push({
    id: "hook",
    label: "Cold-open hook",
    status: scenes[0]?.hook ? "pass" : "warn",
    detail: scenes[0]?.hook
      ? `Scene 1 opens with: “${scenes[0].hook}”`
      : "Scene 1 has no hook — consider the A/B/C picker.",
  });
  checks.push({
    id: "microhooks",
    label: "Microhooks across cuts",
    status: coverage >= 0.6 ? "pass" : coverage >= 0.3 ? "warn" : "fail",
    detail: `${Math.round(coverage * 100)}% of transitions pull forward (target ≥ 60%).`,
  });
  checks.push({
    id: "value-bomb",
    label: "Value bomb at 60–70%",
    status: bomb >= 0 ? "pass" : "warn",
    detail: bomb >= 0
      ? `Scene ${bomb + 1} lands in the drop-off zone.`
      : "No scene starts in the 60–70% band — the payoff may land too late.",
  });
  const total = sb.total;
  checks.push({
    id: "duration",
    label: "Aspect & duration",
    status: total >= TIMING.MIN_TOTAL_S && total <= TIMING.MAX_TOTAL_S ? "pass" : "fail",
    detail: `${total}s total (allowed ${TIMING.MIN_TOTAL_S}–${TIMING.MAX_TOTAL_S}s).`,
  });
  const longScenes = scenes.filter((s) => s.duration > 8).length;
  checks.push({
    id: "pacing",
    label: "Pacing mix",
    status: longScenes === scenes.length ? "warn" : "pass",
    detail: longScenes === scenes.length
      ? "Every scene is a slow beat — mix in some quick cuts."
      : `${scenes.length - longScenes} quick beat(s) against ${longScenes} slow beat(s).`,
  });
  return checks;
}