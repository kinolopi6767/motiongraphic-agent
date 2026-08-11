#!/usr/bin/env node
/**
 * director.mjs — Director agent: brief/script -> validated storyboard.json.
 * Encodes the retention contract (cold-open hook, value bomb at 60-70%,
 * micro-hooks between scenes) and the verb palette.
 *
 * Usage: node src/director.mjs <script-file> [out-json]
 */
import { readFile, writeFile } from "node:fs/promises";
import { chat } from "./llm.mjs";
import { validateStoryboard, VERBS } from "./schema.mjs";

const [scriptFile, outFile = "storyboard.json"] = process.argv.slice(2);
if (!scriptFile) {
  console.error("usage: node src/director.mjs <script-file> [out-json]");
  process.exit(1);
}
const script = await readFile(scriptFile, "utf8");

const SYSTEM = `You are the DIRECTOR AGENT of an agentic motion-graphics video engine.
Turn a script/brief into a storyboard.json. Requirements:
- Scene verbs limited to: ${VERBS.join(", ")}.
- Total 8-90s, each scene 4-12s.
- Retention contract: cold-open/hook energy in scene 1, value bomb at 60-70%,
  a forward-pull microhook at the end of each scene.
- All factual values MUST come from the script. Never invent data.
- Colors: small intentional palette (max 4) with one accent for hierarchy.
- Every scene needs a complete values object for its verb.
Return ONLY valid JSON.`;

const PROMPT = `SCRIPT:\n${script}\n\nProduce storyboard.json with fields:
title, formatArchetype (case-study|data-explainer|systems-explainer|timeline),
scenes[] each {verb, duration, values, hook?, microhook?, tone?}.

Verb -> values contracts:
- count-up:       {value:number, label:string, suffix?, prefix?, accent?, display?}
- chart-race:     {title:string, items:[{label,value,color?}], accent?}
- kinetic-title:  {lines:string[], accent?, accentOn?:number, kicker?}
- pipeline-flow:  {title:string, nodes:[{label,color?}], accent?}

No filler scenes — only what the script earns.`;

console.error("[director] calling LLM...");
let sb;
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    sb = await chat({ system: SYSTEM, prompt: PROMPT, json: true });
    const errors = validateStoryboard(sb);
    if (errors.length) {
      console.error(`[director] invalid (${errors.length}): ${errors.join("; ")}`);
      if (attempt === 2) throw new Error("storyboard invalid after retry");
      await new Promise((r) => setTimeout(r, 400));
    } else break;
  } catch (e) {
    console.error(`[director] LLM error: ${e.message}`);
    if (attempt === 2) throw e;
  }
}

await writeFile(outFile, JSON.stringify(sb, null, 2));
console.error(`[director] wrote ${outFile}`);
console.log(JSON.stringify(sb, null, 2));
