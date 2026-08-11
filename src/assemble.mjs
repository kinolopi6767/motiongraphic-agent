#!/usr/bin/env node
/**
 * assemble.mjs — Phase 1 assembler
 *
 * Given a project dir + scenes manifest, writes a self-contained HyperFrames
 * composition: index.html (sub-composition embeds) + copied motion-verb
 * templates + vendored assets. Pure code, no LLM — deterministic output.
 *
 * Usage: node src/assemble.mjs <project-dir> <manifest.json>
 *
 * manifest.json:
 * {
 *   "id": "probe",
 *   "width": 1920, "height": 1080, "fps": 30,
 *   "scenes": [
 *     { "verb": "kinetic-title", "duration": 8,
 *       "values": { "startMs": 0, "lines": ["Four verbs in."] } }
 *   ]
 * }
 */
import { mkdir, cp, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [projectDir, manifestPath] = process.argv.slice(2);
if (!projectDir || !manifestPath) {
  console.error("usage: node src/assemble.mjs <project-dir> <manifest.json>");
  process.exit(1);
}

const REPO = resolve(import.meta.dirname, "..");
const VERBS = join(REPO, "templates", "motion-verbs");
const ASSETS = join(REPO, "assets");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const out = resolve(projectDir);

// Ratio variants (one render, three ratios): the master canvas is 1920x1080;
// other ratios wrap it in a centered, scaled container on the target canvas.
const RATIO_SIZE = { "16:9": [1920, 1080], "1:1": [1080, 1080], "9:16": [1080, 1920] };
const ratio = manifest.ratio && RATIO_SIZE[manifest.ratio] ? manifest.ratio : "16:9";
const [CANVAS_W, CANVAS_H] = RATIO_SIZE[ratio];
const SCALE = CANVAS_W / 1920;

const masterBox = ratio === "16:9"
  ? ""
  : `<div style="position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform:translate(-50%,-50%) scale(${SCALE});transform-origin:center">
`;

const masterBoxClose = ratio === "16:9" ? "" : `</div>
`;

await mkdir(join(out, "motion-verbs"), { recursive: true });
await mkdir(join(out, "assets", "vendor"), { recursive: true });
await mkdir(join(out, "compositions"), { recursive: true });
await cp(join(ASSETS, "vendor", "gsap.min.js"), join(out, "assets", "vendor", "gsap.min.js"));

let t = 0;
const embeds = [];
const total = manifest.scenes.reduce((s, sc) => s + sc.duration, 0);

for (let i = 0; i < manifest.scenes.length; i++) {
  const sc = manifest.scenes[i];
  await cp(
    join(VERBS, `${sc.verb}.html`),
    join(out, "motion-verbs", `${sc.verb}.html`)
  );
  const values = { startMs: 0, sceneMs: sc.duration * 1000, ...sc.values };
  embeds.push(`      <!-- scene ${i + 1}: ${sc.verb} @${t}s -->
      <div id="scene-${i + 1}-${sc.verb}" data-composition-id="s${i + 1}-${sc.verb}"
           data-composition-src="motion-verbs/${sc.verb}.html"
           data-start="${t}" data-duration="${sc.duration}"
           data-variable-values='${JSON.stringify(values)}'></div>`);

  // Zero-gap segment compositions (Phase 5 chaptered re-edit): one file per
  // scene, timeline starting at 0 — renders as its own MP4 segment.
  const seg = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${CANVAS_W}, height=${CANVAS_H}" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${CANVAS_W}px; height: ${CANVAS_H}px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <div data-composition-id="${manifest.id}-seg${i}" data-start="0" data-duration="${sc.duration}"
         data-width="${CANVAS_W}" data-height="${CANVAS_H}" data-fps="${manifest.fps}"
         data-no-timeline>
${masterBox}      <div id="scene-${i + 1}-${sc.verb}" data-composition-id="s${i + 1}-${sc.verb}"
           data-composition-src="motion-verbs/${sc.verb}.html"
           data-start="0" data-duration="${sc.duration}"
           data-variable-values='${JSON.stringify(values)}'></div>
${masterBoxClose}    </div>
  </body>
</html>
`;
  await writeFile(join(out, "compositions", `scene-${i}.html`), seg);
  t += sc.duration;
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${CANVAS_W}, height=${CANVAS_H}" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${CANVAS_W}px; height: ${CANVAS_H}px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <div data-composition-id="${manifest.id}" data-start="0" data-duration="${total}"
         data-width="${CANVAS_W}" data-height="${CANVAS_H}" data-fps="${manifest.fps}"
         data-no-timeline>
${masterBox}
${embeds.join("\n")}
${masterBoxClose}    </div>
  </body>
</html>
`;

await writeFile(join(out, "index.html"), html);
console.log(`assembled ${manifest.id}: ${manifest.scenes.length} scenes, ${total}s -> ${out}`);
