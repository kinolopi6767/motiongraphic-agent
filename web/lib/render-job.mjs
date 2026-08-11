#!/usr/bin/env node
/**
 * render-job.mjs — background render worker for the web studio.
 * Extracts the approved storyboard, runs the pipeline orchestrator with
 * --storyboard (no re-directing; the review gate is the source of truth),
 * and tracks lifecycle in the job JSON.
 *
 * Usage: node lib/render-job.mjs <storyboard-record.json> <jobId> <jobFile> [outDir] [seed]
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const [recordFile, jobId, jobFile, outDirArg, seedArg] = process.argv.slice(2);
const ROOT = process.env.PIPELINE_ROOT || resolve(process.cwd(), "..");
const JOB_DIR = join(process.cwd(), "data", "jobs");

// Ensure ffmpeg/ffprobe (static builds in <repo>/.tools) reach hyperframes.
process.env.PATH = [join(ROOT, ".tools"), process.env.PATH].filter(Boolean).join(":");

const outDir = outDirArg ? resolve(outDirArg) : join(ROOT, "output", "web-jobs");

function fail(message) {
  writeFile(jobFile, JSON.stringify({ id: jobId, status: "failed", error: message }, null, 2)).catch(() => {});
  process.exit(1);
}

/** Collect contact-sheet frames written to the pipeline output since the job started. */
async function collectFrames(sinceMs) {
  const found = [];
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && /\.png$/i.test(e.name)) {
        try {
          const st = await stat(p);
          if (st.mtimeMs >= sinceMs) found.push(p);
        } catch {}
      }
    }
  };
  await walk(outDir);
  return found.sort().slice(0, 24);
}

try {
  const record = JSON.parse(await readFile(recordFile, "utf8"));
  const storyboard = record.storyboard;
  if (!storyboard?.scenes?.length) fail("record has no storyboard");

  await mkdir(JOB_DIR, { recursive: true });
  await writeFile(
    jobFile,
    JSON.stringify(
      { id: jobId, storyboardId: record.id, status: "queued", createdAt: new Date().toISOString() },
      null,
      2
    )
  );

  // The orchestrator consumes a raw storyboard.json — extract it from the record.
  const sbFile = join(JOB_DIR, `${jobId}.storyboard.json`);
  await writeFile(sbFile, JSON.stringify(storyboard, null, 2));

  await writeFile(
    jobFile,
    JSON.stringify(
      { id: jobId, storyboardId: record.id, status: "running", startedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      null,
      2
    )
  );

  const seed = seedArg || undefined;
  const startedAtMs = Date.now();

  // Contact sheets: one snapshot per scene at its midpoint (PLAN §4, §9).
  let t = 0;
  const mids = storyboard.scenes.map((s) => {
    const mid = t + s.duration / 2;
    t += s.duration;
    return mid.toFixed(2);
  });

  const args = [
    "src/agent.mjs",
    `--storyboard=${sbFile}`,
    `--out-dir=${outDir}`,
    `--snapshot=${mids.join(",")}`,
    "--render",
  ];
  if (seed) args.push(`--seed=${seed}`);
  const child = spawn("node", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });

  let log = "";
  /** Map pipeline stderr markers -> job stage (Flow D status chips). */
  const mapStage = (line) => {
    if (/using approved storyboard|director|scene agent/i.test(line)) return "planning";
    if (/manifest|assemble|wrote program/i.test(line)) return "assembling";
    if (/snapshot|render|rendered|Render complete/i.test(line)) return "rendering";
    return null;
  };
  const updateStage = async (stage) => {
    try {
      const cur = JSON.parse(await readFile(jobFile, "utf8"));
      cur.stage = stage;
      cur.updatedAt = new Date().toISOString();
      await writeFile(jobFile, JSON.stringify(cur, null, 2));
    } catch {}
  };
  child.stdout.on("data", (d) => {
    log += d;
    const stage = mapStage(String(d));
    if (stage) updateStage(stage);
  });
  child.stderr.on("data", (d) => {
    log += d;
    const stage = mapStage(String(d));
    if (stage) updateStage(stage);
  });

  child.on("error", (e) => fail(`spawn failed: ${e.message}`));

  child.on("close", async (code) => {
    const logFile = join(JOB_DIR, `${jobId}.log`);
    await mkdir(JOB_DIR, { recursive: true });
    await writeFile(logFile, log);

    const m = log.match(/rendered: (.+\.mp4)/);
    const videoPath = m ? resolve(m[1].trim()) : null;
    const frames = code === 0 ? await collectFrames(startedAtMs) : [];

    if (code === 0 && videoPath) {
      await writeFile(
        jobFile,
        JSON.stringify(
          {
            id: jobId,
            storyboardId: record.id,
            status: "done",
            videoPath,
            frames,
            seed,
            createdAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            logFile,
          },
          null,
          2
        )
      );
    } else {
      await writeFile(
        jobFile,
        JSON.stringify(
          {
            id: jobId,
            storyboardId: record.id,
            status: "failed",
            error: code === 0 ? "render finished but no MP4 found" : `exited with code ${code}`,
            createdAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            logFile,
          },
          null,
          2
        )
      );
    }
  });
} catch (e) {
  fail(e.message);
}
