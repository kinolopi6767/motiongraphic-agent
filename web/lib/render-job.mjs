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
import { execFileSync, spawn } from "node:child_process";

const [recordFile, jobId, jobFile, outDirArg, seedArg] = process.argv.slice(2);
const ROOT = process.env.PIPELINE_ROOT || resolve(process.cwd(), "..");
const JOB_DIR = join(process.cwd(), "data", "jobs");

// Ensure ffmpeg/ffprobe (static builds in <repo>/.tools) reach hyperframes.
process.env.PATH = [join(ROOT, ".tools"), process.env.PATH].filter(Boolean).join(":");
const FF = join(ROOT, ".tools", "ffmpeg");

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

/** Decode a PNG to 480x270 grayscale raw bytes for cheap pixel diffing. */
function decodeGray(p) {
  return execFileSync(FF, ["-v", "error", "-i", p, "-vf", "scale=480:270,format=gray", "-f", "rawvideo", "-"]);
}

/** Mean absolute per-pixel difference between two decoded frames. */
function meanAbsDiff(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return n > 0 ? sum / n : 0;
}

const MOTION_PASS_THRESHOLD = 2.0; // mean gray diff per pixel (0-255)

/**
 * No-stasis check (PLAN §5, render tier): diff consecutive contact-sheet
 * frames within each scene; a scene with near-zero drift failed the check.
 */
function measureMotion(frames, scenes) {
  const windows = [];
  let t = 0;
  for (const s of scenes) {
    windows.push({ from: t, to: t + s.duration, duration: s.duration });
    t += s.duration;
  }
  const byScene = windows.map(() => []);
  for (const p of frames) {
    const m = /at-([\d.]+)s\.png$/.exec(p);
    const at = m ? Number(m[1]) : null;
    const idx = windows.findIndex((w) => at !== null && at >= w.from && at < w.to);
    if (idx >= 0 && idx < byScene.length) byScene[idx].push(p);
  }
  return windows.map((w, i) => {
    const ps = byScene[i];
    const scores = [];
    if (ps.length >= 2) {
      const bufs = ps.map((p) => decodeGray(p));
      for (let j = 1; j < bufs.length; j++) scores.push(meanAbsDiff(bufs[j - 1], bufs[j]));
    }
    const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      scene: i,
      duration: w.duration,
      frames: ps.length,
      score: Number(score.toFixed(2)),
      pass: score >= MOTION_PASS_THRESHOLD,
    };
  });
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

  // Contact sheets + no-stasis sampling (PLAN §4, §5): 3 frames per scene
  // (open, midpoint, close) feed both the filmstrip and the motion guard.
  let t = 0;
  const ats = [];
  for (const s of storyboard.scenes) {
    const open = Math.min(t + 0.8, t + s.duration - 0.2);
    const mid = t + s.duration / 2;
    const close = Math.max(t + s.duration - 0.8, mid + 0.1);
    for (const at of [open, mid, close]) {
      if (at >= t && at < t + s.duration && at < storyboard.total - 0.1) ats.push(Number(at.toFixed(2)));
    }
    t += s.duration;
  }

  const args = [
    "src/agent.mjs",
    `--storyboard=${sbFile}`,
    `--out-dir=${outDir}`,
    `--snapshot=${ats.join(",")}`,
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
    const motion = code === 0 && frames.length >= 2 ? measureMotion(frames, storyboard.scenes) : [];
    const frameTimes = frames.map((p) => {
      const tm = /at-([\d.]+)s\.png$/.exec(p);
      return tm ? Number(tm[1]) : null;
    });

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
            frameTimes,
            motion,
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
