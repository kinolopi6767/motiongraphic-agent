#!/usr/bin/env node
/**
 * run-next.mjs — boots the studio on the first free port (3000, 3001, …).
 * `next dev` auto-increments ports, but `next start` errors when 3000 is busy
 * (e.g. another dev server like the Astro site holds it). This probes a free
 * TCP port and starts Next there.
 *
 * Usage: node scripts/run-next.mjs [dev|start]
 */
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const mode = process.argv[2] === "start" ? "start" : "dev";
const here = dirname(fileURLToPath(import.meta.url));
const nextBin = join(here, "..", "node_modules", ".bin", "next");

if (mode === "start") {
  const prod = join(here, "..", ".next", "BUILD_ID");
  if (!existsSync(prod)) {
    console.error("No production build found. Run `npm run build` first.");
    process.exit(1);
  }
}

const isBusy = (port) =>
  new Promise((resolve) => {
    const s = createConnection({ port, host: "127.0.0.1" });
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });

let port = Number(process.env.PORT) || 0;
if (port) {
  if (await isBusy(port)) {
    console.error(`Port ${port} is busy (another project?) — probing a free port instead.`);
    port = 0;
  }
}
if (!port) {
  for (let p = 3000; p < 3100; p++) {
    if (!(await isBusy(p))) {
      port = p;
      break;
    }
  }
}

console.log(`⚡ MotionGraphic Agent ${mode} → http://localhost:${port}`);
if (port !== 3000) {
  console.log(`   (port 3000 is used by another project — open the URL above, NOT localhost:3000)`);
}
const child = spawn(nextBin, [mode, "-p", String(port)], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
