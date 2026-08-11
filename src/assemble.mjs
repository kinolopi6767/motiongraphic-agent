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

await mkdir(join(out, "motion-verbs"), { recursive: true });
await mkdir(join(out, "assets", "vendor"), { recursive: true });
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
  const values = { startMs: 0, ...sc.values };
  embeds.push(`      <!-- scene ${i + 1}: ${sc.verb} @${t}s -->
      <div id="scene-${i + 1}-${sc.verb}" data-composition-id="s${i + 1}-${sc.verb}"
           data-composition-src="motion-verbs/${sc.verb}.html"
           data-start="${t}" data-duration="${sc.duration}"
           data-variable-values='${JSON.stringify(values)}'></div>`);
  t += sc.duration;
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${manifest.width}, height=${manifest.height}" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${manifest.width}px; height: ${manifest.height}px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <div data-composition-id="${manifest.id}" data-start="0" data-duration="${total}"
         data-width="${manifest.width}" data-height="${manifest.height}" data-fps="${manifest.fps}"
         data-no-timeline>
${embeds.join("\n")}
    </div>
  </body>
</html>
`;

await writeFile(join(out, "index.html"), html);
console.log(`assembled ${manifest.id}: ${manifest.scenes.length} scenes, ${total}s -> ${out}`);
