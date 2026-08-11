#!/usr/bin/env node
/**
 * schema.mjs — storyboard.json validation (the actor contract).
 * Director + scene agents MUST satisfy this; violations trigger agent retries.
 */

export const VERBS = ["count-up", "chart-race", "kinetic-title", "pipeline-flow", "timeline", "radial-gauge"];

export const TIMING = {
  MIN_SCENE_S: 4,
  MAX_SCENE_S: 12,
  MIN_TOTAL_S: 8,
  MAX_TOTAL_S: 90,
};

export function validateStoryboard(sb) {
  const errors = [];
  if (!sb || typeof sb !== "object") return ["storyboard is not an object"];
  if (!sb.title || typeof sb.title !== "string" || !sb.title.trim()) errors.push("title missing");
  if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) errors.push("scenes must be a non-empty array");
  if (Array.isArray(sb.scenes)) {
    sb.scenes.forEach((s, i) => {
      if (!s) return errors.push(`scene ${i}: null`);
      if (!VERBS.includes(s.verb)) errors.push(`scene ${i}: unknown verb "${s?.verb}" (allowed: ${VERBS.join(", ")})`);
      if (typeof s.duration !== "number" || s.duration < TIMING.MIN_SCENE_S || s.duration > TIMING.MAX_SCENE_S)
        errors.push(`scene ${i}: duration ${s?.duration} out of range [${TIMING.MIN_SCENE_S}, ${TIMING.MAX_SCENE_S}]`);
      if (!s.values || typeof s.values !== "object") errors.push(`scene ${i}: values missing`);
    });
    const total = sb.scenes.reduce((a, s) => a + (s.duration || 0), 0);
    if (total < TIMING.MIN_TOTAL_S || total > TIMING.MAX_TOTAL_S)
      errors.push(`total duration ${total}s out of range`);
  }
  return errors;
}

export function validateSceneValues(verb, values) {
  const errors = [];
  if (!values || typeof values !== "object") return ["values missing"];
  switch (verb) {
    case "count-up":
      if (typeof values.value !== "number") errors.push("count-up: value must be a number");
      if (!values.label || typeof values.label !== "string") errors.push("count-up: label required");
      break;
    case "chart-race":
      if (!Array.isArray(values.items) || values.items.length < 2 || values.items.length > 6)
        errors.push("chart-race: items must be an array of 2-6");
      values?.items?.forEach((it, i) => {
        if (!it || typeof it.value !== "number" || !it.label) errors.push(`chart-race: item ${i} needs label+value`);
      });
      if (typeof values.title !== "string" || !values.title) errors.push("chart-race: title required");
      break;
    case "kinetic-title":
      if (!Array.isArray(values.lines) || values.lines.length < 1 || values.lines.length > 3)
        errors.push("kinetic-title: lines must be 1-3");
      if (values.accentOn !== undefined && (typeof values.accentOn !== "number" || values.accentOn < 0 || values.accentOn > (values.lines?.length || 1) - 1))
        errors.push("kinetic-title: accentOn out of range");
      break;
    case "pipeline-flow":
      if (!Array.isArray(values.nodes) || values.nodes.length < 2 || values.nodes.length > 6)
        errors.push("pipeline-flow: nodes must be 2-6");
      if (typeof values.title !== "string" || !values.title) errors.push("pipeline-flow: title required");
      break;
    case "timeline":
      if (!Array.isArray(values.events) || values.events.length < 2 || values.events.length > 6)
        errors.push("timeline: events must be 2-6");
      values?.events?.forEach((it, i) => {
        if (!it || !it.label) errors.push(`timeline: event ${i} needs a label`);
      });
      if (typeof values.title !== "string" || !values.title) errors.push("timeline: title required");
      break;
    case "radial-gauge":
      if (typeof values.value !== "number" || values.value < 0 || values.value > 9999)
        errors.push("radial-gauge: value must be a number");
      if (!values.label || typeof values.label !== "string") errors.push("radial-gauge: label required");
      break;
    default:
      errors.push(`unknown verb ${verb}`);
  }
  return errors;
}
