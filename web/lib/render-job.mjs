#!/usr/bin/env node
/**
 * render-job.mjs — background render worker for the web studio.
 *
 * Chaptered pipeline (PLAN Phase 5):
 *   full    : renders every scene segment per ratio, concats per ratio, adds
 *             SFX (+voice) once, muxes per ratio, extracts value-bomb
 *             thumbnails per ratio.
 *   segment : re-renders ONLY scene <sceneIndex> per ratio and splices it into
 *             the cached segments of the previous done job (same seed →
 *             untouched segments are bit-identical).
 *
 * Usage: node lib/render-job.mjs <record.json> <jobId> <jobFile> [outDir] [seed]
 *                                 [kind] [sceneIndex] [ratios]
 */
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";

const [recordFile, jobId, jobFile, outDirArg, seedArg, kindArg, sceneIndexArg, ratiosArg] = process.argv.slice(2);
const ROOT = process.env.PIPELINE_ROOT || resolve(process.cwd(), "..");
const JOB_DIR = join(process.cwd(), "data", "jobs");
const kind = kindArg === "segment" ? "segment" : "full";
const sceneIndex = kind === "segment" ? Number(sceneIndexArg) : undefined;

// Ensure ffmpeg/ffprobe (static builds in <repo>/.tools) reach hyperframes.
process.env.PATH = [join(ROOT, ".tools"), process.env.PATH].filter(Boolean).join(":");
const FF = join(ROOT, ".tools", "ffmpeg");

const RATIOS = ["16:9", "1:1", "9:16"];
const RATIO_SLUG = { "16:9": "169", "1:1": "11", "9:16": "916" };

const outDir = outDirArg ? resolve(outDirArg) : join(ROOT, "output", "web-jobs");

function fail(message) {
  writeFile(jobFile, JSON.stringify({ id: jobId, status: "failed", error: message }, null, 2)).catch(() => {});
  process.exit(1);
}

/** Worker self-logging (detached spawn hides stdout — mirror to a file). */
let workerLogBuf = "";
function wlog(msg) {
  workerLogBuf += `[${new Date().toISOString()}] ${msg}\n`;
  writeFile(join(JOB_DIR, `${jobId}.worker.log`), workerLogBuf).catch(() => {});
}

/** Collect contact-sheet frames written under a pipeline root since the job started. */
async function collectFrames(rootDir, sinceMs) {
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
  await walk(rootDir);
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

/** First scene starting inside the 60–70% window — thumbnail + SFX moment. */
function valueBombIndex(scenes, total) {
  let t = 0;
  for (let i = 0; i < scenes.length; i++) {
    const startFrac = t / total;
    if (startFrac >= 0.6 && startFrac < 0.7) return i;
    t += scenes[i].duration;
  }
  return -1;
}

/** Latest done job for the same storyboard (segment cache source). */
async function previousJob(storyboardId) {
  let files;
  try {
    files = (await readdir(JOB_DIR)).filter((f) => f.endsWith(".json") && !f.includes(".storyboard."));
  } catch {
    return null;
  }
  let best = null;
  for (const f of files) {
    try {
      const j = JSON.parse(await readFile(join(JOB_DIR, f), "utf8"));
      if (
        j.id !== jobId &&
        j.storyboardId === storyboardId &&
        j.status === "done" &&
        j.ratios &&
        j.ratioRuns
      ) {
        if (!best || (j.finishedAt || "") > (best.finishedAt || "")) best = j;
      }
    } catch {}
  }
  return best;
}

async function readConfig() {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "data", "config.json"), "utf8"));
  } catch {
    return {};
  }
}

/** Run one agent pass (per ratio); returns { log, projectDir, code }. */
async function runAgent(args, env) {
  const child = spawn("node", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env });
  let log = "";
  const updateStage = async (stage) => {
    try {
      const cur = JSON.parse(await readFile(jobFile, "utf8"));
      cur.stage = stage;
      cur.updatedAt = new Date().toISOString();
      await writeFile(jobFile, JSON.stringify(cur, null, 2));
    } catch {}
  };
  const mapStage = (line) => {
    if (/using approved storyboard|director|scene agent/i.test(line)) return "planning";
    if (/manifest|assemble|wrote program|project:/i.test(line)) return "assembling";
    if (/snapshot|segment|render|Render complete/i.test(line)) return "rendering";
    return null;
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
  const code = await new Promise((resolveP) => {
    child.on("error", resolveP.bind(null, -1));
    child.on("close", resolveP);
  });
  const m = log.match(/\[agent\] project: (.+)/);
  return { code, log, projectDir: m ? resolve(m[1].trim()) : null };
}

let recordId;
try {
  const record = JSON.parse(await readFile(recordFile, "utf8"));
  recordId = record.id;
  const storyboard = record.storyboard;
  if (!storyboard?.scenes?.length) fail("record has no storyboard");
  const total = storyboard.scenes.reduce((a, s) => a + s.duration, 0);
  if (sceneIndex !== undefined && (sceneIndex < 0 || sceneIndex >= storyboard.scenes.length)) {
    fail(`invalid scene index: ${sceneIndex}`);
  }

  await mkdir(JOB_DIR, { recursive: true });
  let queuedCost;
  try {
    queuedCost = JSON.parse(await readFile(jobFile, "utf8")).cost;
  } catch {}
  await writeFile(
    jobFile,
    JSON.stringify(
      { id: jobId, storyboardId: record.id, status: "queued", kind, sceneIndex, cost: queuedCost, createdAt: new Date().toISOString() },
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
      {
        id: jobId,
        storyboardId: record.id,
        status: "running",
        kind,
        sceneIndex,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const seed = seedArg || undefined;
  const startedAtMs = Date.now();

  const config = await readConfig();
  const voice = config.voice;
  const voiceEnabled = Boolean(voice?.enabled) && Boolean(voice?.apiKey);
  const env = { ...process.env };
  if (voiceEnabled) {
    env.DEEPGRAM_API_KEY = voice.apiKey;
    if (voice.ttsModel) env.DEEPGRAM_TTS_MODEL = voice.ttsModel;
    if (voice.sttModel) env.DEEPGRAM_STT_MODEL = voice.sttModel;
  }

  // --- ratios to render ---
  let ratios;
  if (kind === "segment") {
    const prev = await previousJob(record.id);
    if (!prev) throw new Error("segment re-render needs a previous done render");
    ratios = (prev.ratios || []).filter((r) => RATIOS.includes(r));
    if (ratios.length === 0) ratios = ["16:9"];
  } else {
    ratios = (ratiosArg || "")
      .split(",")
      .map((r) => r.trim())
      .filter((r) => RATIOS.includes(r));
    if (ratios.length === 0) ratios = [record.ratio && RATIOS.includes(record.ratio) ? record.ratio : "16:9"];
  }

  // 3 frames per scene (open, midpoint, close) for contact sheets + motion guard
  let t = 0;
  const ats = [];
  for (const s of storyboard.scenes) {
    const open = Math.min(t + 0.8, t + s.duration - 0.2);
    const mid = t + s.duration / 2;
    const close = Math.max(t + s.duration - 0.8, mid + 0.1);
    for (const at of [open, mid, close]) {
      if (at >= t && at < t + s.duration && at < total - 0.1) ats.push(Number(at.toFixed(2)));
    }
    t += s.duration;
  }
  const snapArg = `--snapshot=${ats.join(",")}`;

  let masterLog = "";
  const segmentsByRatio = {};
  const runsByRatio = {};

  for (const ratio of ratios) {
    const slug = RATIO_SLUG[ratio];
    const runRoot = join(outDir, `${jobId}-${slug}`);
    await mkdir(runRoot, { recursive: true });
    const args = [
      "src/agent.mjs",
      `--storyboard=${sbFile}`,
      `--out-dir=${runRoot}`,
      snapArg,
      `--ratio=${ratio}`,
      "--render",
    ];
    if (sceneIndex !== undefined) args.push(`--scene=${sceneIndex}`);
    if (seed) args.push(`--seed=${seed}`);

    const { code, log, projectDir } = await runAgent(args, env);
    masterLog += log;
    wlog(`ratio ${ratio}: exit ${code} project ${projectDir}`);
    if (code !== 0 || !projectDir) throw new Error(`pipeline exited with code ${code} (ratio ${ratio})`);

    const segDir = join(projectDir, "segments");
    if (kind === "segment") {
      const prev = await previousJob(record.id);
      const prevRuns = prev?.ratioRuns || {};
      const prevRun = prevRuns[ratio];
      if (!prevRun) throw new Error(`previous job missing ratio run ${ratio}`);
      for (let i = 0; i < storyboard.scenes.length; i++) {
        if (i === sceneIndex) continue;
        const src = join(prevRun, "segments", `seg-${i}.mp4`);
        await cp(src, join(segDir, `seg-${i}.mp4`));
      }
    }

    // sanity + concat -> silent full video
    const segments = [];
    for (let i = 0; i < storyboard.scenes.length; i++) {
      const p = join(segDir, `seg-${i}.mp4`);
      await stat(p);
      segments.push(p);
    }
    const fullMp4 = join(runRoot, `video-${slug}.mp4`);
    const listFile = join(segDir, "concat.txt");
    await writeFile(listFile, segments.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
    execFileSync(FF, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", fullMp4], { stdio: "ignore" });

    segmentsByRatio[ratio] = segments;
    runsByRatio[ratio] = projectDir;
  }

  const primaryRatio = ratios[0];

  // --- audio stage (SFX bed + optional Deepgram narration) — ratio-independent ---
  const primaryRun = runsByRatio[primaryRatio];
  const audioOut = join(primaryRun, "mixed.wav");
  const audioCmd = ["src/audio.mjs", sbFile, audioOut];
  let narrationWav = null;
  let words = [];
  let voiceInfo = null;

  if (voiceEnabled) {
    const tier = record.voiceTier && ["AI-OK", "Hybrid", "Human-only"].includes(record.voiceTier)
      ? record.voiceTier
      : (voice.tier || "AI-OK");
    const briefFile = join(JOB_DIR, `${jobId}.brief.txt`);
    await writeFile(briefFile, String(record.brief ?? ""));
    const dictFile = join(JOB_DIR, `${jobId}.dict.json`);
    await writeFile(dictFile, JSON.stringify(Array.isArray(voice.dictionary) ? voice.dictionary : []));
    try {
      execFileSync("node", ["src/voice.mjs", sbFile, briefFile, primaryRun, tier, dictFile], {
        cwd: ROOT,
        stdio: "inherit",
        env,
      });
      const outWav = join(primaryRun, "narration.wav");
      await stat(outWav);
      narrationWav = outWav;
      try {
        words = JSON.parse(await readFile(join(primaryRun, "words.json"), "utf8"));
      } catch {}
      voiceInfo = {
        tier,
        words: words.length,
        captions: join(primaryRun, "captions.vtt"),
        wordsFile: join(primaryRun, "words.json"),
      };
      wlog(`voice: tier=${tier} words=${words.length}`);
    } catch (e) {
      voiceInfo = { tier, error: e.message, words: 0 };
      wlog(`voice skipped: ${e.message}`);
    }
  }

  if (voiceInfo && voiceInfo.error === undefined && narrationWav) {
    audioCmd.push(narrationWav);
  } else {
    audioCmd.push("none");
  }
  audioCmd.push(seed || "1");

  let rmsReport = [];
  try {
    const out = execFileSync("node", audioCmd, { cwd: ROOT, encoding: "utf8", env });
    const rmsM = out.match(/\[audio\] rms: (.+)/);
    if (rmsM) {
      try {
        rmsReport = JSON.parse(rmsM[1]);
      } catch {}
    }
  } catch (e) {
    wlog(`sfx skipped: ${e.message}`);
  }

  // --- finish per ratio: mux audio + value-bomb thumbnail ---
  const bomb = valueBombIndex(storyboard.scenes, total);
  let bombT = 2;
  let tt = 0;
  for (let i = 0; i < storyboard.scenes.length; i++) {
    if (i === bomb) {
      bombT = tt + 1;
      break;
    }
    tt += storyboard.scenes[i].duration;
  }

  const videos = {};
  const thumbnails = {};
  for (const ratio of ratios) {
    const slug = RATIO_SLUG[ratio];
    const runRoot = join(outDir, `${jobId}-${slug}`);
    const fullMp4 = join(runRoot, `video-${slug}.mp4`);
    const finalMp4 = join(runRoot, `final-${slug}.mp4`);
    execFileSync(
      FF,
      ["-y", "-i", fullMp4, "-i", audioOut, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", finalMp4],
      { stdio: "ignore" }
    );
    const thumbPath = join(runRoot, `thumb-${slug}.jpg`);
    execFileSync(FF, ["-y", "-ss", String(bombT), "-i", finalMp4, "-frames:v", "1", "-q:v", "2", thumbPath], { stdio: "ignore" });
    videos[ratio] = finalMp4;
    thumbnails[ratio] = thumbPath;
  }

  // contact sheets + motion from the primary ratio run
  const frames = await collectFrames(join(outDir, `${jobId}-${RATIO_SLUG[primaryRatio]}`), startedAtMs);
  const motion = frames.length >= 2 ? measureMotion(frames, storyboard.scenes) : [];
  const frameTimes = frames.map((p) => {
    const tm = /at-([\d.]+)s\.png$/.exec(p);
    return tm ? Number(tm[1]) : null;
  });

  const report = {
    jobId,
    kind,
    sceneIndex,
    ratios,
    seed,
    motion,
    sfx: { rms: rmsReport },
    voice: voiceInfo,
    created: new Date().toISOString(),
  };
  await writeFile(join(primaryRun, "report.json"), JSON.stringify(report, null, 2));

  const logFile = join(JOB_DIR, `${jobId}.log`);
  await writeFile(logFile, masterLog);

  await writeFile(
    jobFile,
    JSON.stringify(
      {
        id: jobId,
        storyboardId: record.id,
        status: "done",
        kind,
        sceneIndex,
        ratios,
        videoPath: videos[primaryRatio],
        videos,
        thumbnailPath: thumbnails[primaryRatio],
        thumbnails,
        ratioRuns: runsByRatio,
        segments: segmentsByRatio[primaryRatio],
        frames,
        frameTimes,
        motion,
        sfx: rmsReport.length > 0,
        voice: voiceInfo,
        seed,
        cost: queuedCost,
        createdAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        logFile,
      },
      null,
      2
    )
  );
} catch (e) {
  const logFile = join(JOB_DIR, `${jobId}.log`);
  try {
    await writeFile(logFile, `[worker] ${e.message}\n`);
  } catch {}
  await writeFile(
    jobFile,
    JSON.stringify(
      {
        id: jobId,
        storyboardId: recordId,
        status: "failed",
        kind,
        sceneIndex,
        error: e.message,
        createdAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        logFile,
      },
      null,
      2
    )
  );
}
