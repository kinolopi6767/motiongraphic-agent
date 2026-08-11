#!/usr/bin/env node
/**
 * agent.mjs — pipeline orchestrator.
 * script.json -> director (storyboard) -> (scene agents: fill/validate values)
 * -> manifest -> assemble -> hyperframes render -> MP4.
 *
 * Usage:
 *   node src/agent.mjs <script-file> [out-dir] [--render] [--snapshot AT,...] [--seed=<s>]
 *
 * Currently scene values come straight from the director's storyboard (single
 * LLM pass, validated). The per-scene agent hook is where scene agents will
 * deep-dive each scene later (code2mp4 style) without blowing context.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chat } from "./llm.mjs";
import { validateStoryboard, validateSceneValues, VERBS } from "./schema.mjs";

const args = process.argv.slice(2);
const positionals = args.filter((a) => !a.startsWith("-"));
const flags = args.filter((a) => a.startsWith("-"));
const scriptFile = positionals[0];
const outDirFlag = flags.find((f) => f.startsWith("--out-dir="))?.split("=")[1];
const outDir = outDirFlag ? resolve(outDirFlag) : resolve(positionals[1] || "output/agent-runs");
await mkdir(outDir, { recursive: true });

const doRender = flags.includes("--render");
const snapAt = flags.find((f) => f.startsWith("--snapshot"))?.split("=")[1];
const seed = flags.find((f) => f.startsWith("--seed="))?.split("=")[1];
// --storyboard=<file>: render an approved storyboard as-is (web storyboard gate).
// Skips the director LLM pass — the review-approved board is the source of truth.
const existingStoryboard = flags.find((f) => f.startsWith("--storyboard"))?.split("=")[1];
const script = existingStoryboard ? null : await readFile(scriptFile, "utf8");

// 1) DIRECTOR
let storyboard;
if (existingStoryboard) {
  storyboard = JSON.parse(await readFile(existingStoryboard, "utf8"));
  const errors = validateStoryboard(storyboard);
  if (errors.length) throw new Error(`existing storyboard invalid: ${errors.join("; ")}`);
  console.error(`[agent] using approved storyboard: ${existingStoryboard}`);
} else {
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    storyboard = await chat({
      system: `You are the DIRECTOR AGENT of an agentic motion-graphics video engine.
Turn a script into storyboard.json. Verbs: ${VERBS.join(", ")}. Total 8-90s, scenes 4-12s.
Retention contract: cold-open hook in scene 1, value bomb at 60-70%, microhooks between scenes.
All factual values from the script only. Max 4 colors, one accent. Return ONLY valid JSON.`,
      prompt: `SCRIPT:\n${script}\n\nstoryboard.json fields: title, formatArchetype, scenes[{verb, duration, values, hook?, microhook?, tone?}].
Verb contracts:
- count-up: {value, label, suffix?, prefix?, accent?}
- chart-race: {title, items:[{label,value,color?}], accent?}
- kinetic-title: {lines, accent?, accentOn?, kicker?}
- pipeline-flow: {title, nodes:[{label,color?}], accent?}`,
      json: true,
    });
    const errors = validateStoryboard(storyboard);
    if (!errors.length) break;
    console.error(`[agent] director invalid: ${errors.join("; ")} (retry ${attempt})`);
    if (attempt === 2) throw new Error("storyboard invalid after retry");
  } catch (e) {
    console.error(`[agent] director LLM error: ${e.message}`);
    if (attempt === 2) throw e;
  }
}
}

// 2) SCENE AGENTS (lightweight pass: verify + refine each scene's values)
for (const scene of storyboard.scenes) {
  const errs = validateSceneValues(scene.verb, scene.values);
  if (!errs.length) continue;
  console.error(`[agent] scene "${scene.verb}" invalid: ${errs.join("; ")} — asking scene agent to fix...`);
  const fixed = await chat({
    system: `Fix the scene's values so they satisfy: ${errs.join("; ")}. Keep data faithful to the script. Return ONLY the corrected values object.`,
    prompt: JSON.stringify({ verb: scene.verb, values: scene.values, script: script ?? "no script" }),
    json: true,
  });
  scene.values = fixed;
}

const sbPath = join(outDir, "storyboard.json");
await writeFile(sbPath, JSON.stringify(storyboard, null, 2));
console.error(`[agent] storyboard written: ${sbPath}`);

// 3) MANIFEST
const projectId = `run-${Date.now().toString(36)}`;
const projectDir = join(outDir, projectId);
const manifest = {
  id: projectId,
  width: 1920,
  height: 1080,
  fps: 30,
  ...(seed ? { seed } : {}),
  scenes: storyboard.scenes.map((s) => ({ verb: s.verb, duration: s.duration, values: s.values })),
};
const manifestPath = join(outDir, "manifest.json");
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.error(`[agent] manifest: ${manifestPath}`);

// 4) ASSEMBLE
execFileSync("node", ["src/assemble.mjs", projectDir, manifestPath], { stdio: "inherit" });

// 5) SNAPSHOT / RENDER
const fps = manifest.fps;
if (snapAt) {
  execFileSync("npx", ["hyperframes", "snapshot", projectDir, "--at", snapAt], { stdio: "inherit" });
}
if (doRender) {
  const out = join(outDir, `${projectId}.mp4`);
  execFileSync("npx", ["hyperframes", "render", projectDir, "-o", out], { stdio: "inherit" });
  console.error(`[agent] rendered: ${out}`);
}
console.error(`[agent] done -> ${projectDir}`);
