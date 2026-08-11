#!/usr/bin/env node
/**
 * render-job.mjs — background render worker for the web studio.
 * Extracts the approved storyboard, runs the pipeline orchestrator with
 * --storyboard (no re-directing; the review gate is the source of truth),
 * and tracks lifecycle in the job JSON.
 *
 * Usage: node lib/render-job.mjs <storyboard-record.json> <jobId> <jobFile> [outDir]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const [recordFile, jobId, jobFile, outDirArg] = process.argv.slice(2);
const ROOT = process.env.PIPELINE_ROOT || resolve(process.cwd(), "..");
const JOB_DIR = join(process.cwd(), "data", "jobs");

const outDir = outDirArg ? resolve(outDirArg) : join(ROOT, "output", "web-jobs");

function fail(message) {
  writeFile(jobFile, JSON.stringify({ id: jobId, status: "failed", error: message }, null, 2)).catch(() => {});
  process.exit(1);
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

  const child = spawn("node", ["src/agent.mjs", `--storyboard=${sbFile}`, `--out-dir=${outDir}`, "--render"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

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

    if (code === 0 && videoPath) {
      await writeFile(
        jobFile,
        JSON.stringify(
          {
            id: jobId,
            storyboardId: record.id,
            status: "done",
            videoPath,
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
