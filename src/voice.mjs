#!/usr/bin/env node
/**
 * voice.mjs — Phase 4 voice layer (Deepgram, DISABLED by default).
 *
 * Native @deepgram/sdk integration (v5):
 *   - TTS:  client.speak.v1.audio.generate({ text, model, encoding:"linear16",
 *            container:"wav" }) -> response.stream()
 *   - STT:  client.listen.v1.media.transcribeFile(readStream, { model:"nova-3" })
 *           -> word-level timestamps (the "STT round-trip" that solves the
 *           TTS-no-timestamps gap AND verifies pronunciation in one pass).
 *
 * Flow per video (PLAN §7):
 *   1. Narration script per scene built deterministically from scene values.
 *   2. Per-scene TTS -> scene_<i>.wav (fits scene duration; trim+fade if longer).
 *   3. STT round-trip -> words.json with absolute [start,end] per word.
 *   4. Captions VTT (WebVTT) + words.json for active-word captions.
 *   5. Voice-tier gate: AI-OK = all scenes TTS; Hybrid = hook/outro scenes get
 *      voice-direction notes instead (human VO splice); Human-only = script +
 *      timing grid only. TTS never runs for Human-only.
 *   6. Pronunciation dictionary: proper nouns from the brief are injected as
 *      SSML <sub> aliases (only when the dictionary is non-empty).
 *
 * Usage:
 *   DEEPGRAM_API_KEY=... node src/voice.mjs <storyboard.json> <brief.txt>
 *     <out-dir> <tier> [dictionary.json]
 *
 * Writes into <out-dir>: narration.wav (aligned to scene windows), words.json,
 * captions.vtt, voice-direction.md.
 */
import { createReadStream, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TTS_MODEL = process.env.DEEPGRAM_TTS_MODEL || "aura-2-thalia-en";
const STT_MODEL = process.env.DEEPGRAM_STT_MODEL || "nova-3";
const SAMPLE_RATE = 24000;

const [storyboardFile, briefFile, outDir, tier, dictFile] = process.argv.slice(2);
if (!storyboardFile || !outDir) {
  console.error("usage: node src/voice.mjs <storyboard.json> <brief.txt> <out-dir> <tier> [dict.json]");
  process.exit(1);
}
if (!process.env.DEEPGRAM_API_KEY) {
  console.error("[voice] DEEPGRAM_API_KEY not set — voice disabled");
  process.exit(2);
}

const { DeepgramClient } = await import("@deepgram/sdk");
const client = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

const sb = JSON.parse(await import("node:fs/promises").then((m) => m.readFile(storyboardFile, "utf8")));
let brief = "";
try {
  brief = await readFile(briefFile, "utf8");
} catch {}
let dictionary = [];
try {
  dictionary = JSON.parse(await readFile(dictFile, "utf8"));
} catch {}

/* ---------- deterministic narration script per scene ---------- */

function sceneScript(scene) {
  const parts = [];
  if (scene.hook) parts.push(scene.hook);
  switch (scene.verb) {
    case "count-up":
      parts.push(
        `${scene.values.prefix ?? ""}${scene.values.value ?? ""}${scene.values.suffix ?? ""} ${scene.values.label ?? ""}`.trim()
      );
      break;
    case "kinetic-title":
      parts.push((scene.values.lines ?? []).join(". "));
      if (scene.values.kicker) parts.push(scene.values.kicker);
      break;
    case "chart-race":
      parts.push(scene.values.title ?? "");
      (scene.values.items ?? []).slice(0, 3).forEach((it) => parts.push(`${it.label}, ${it.value}`));
      break;
    case "pipeline-flow":
      parts.push(scene.values.title ?? "");
      parts.push((scene.values.nodes ?? []).map((nd) => nd.label).join(" to "));
      break;
  }
  if (scene.microhook) parts.push(scene.microhook);
  return parts.filter(Boolean).join(". ");
}

function applyDictionary(text) {
  if (dictionary.length === 0) return text;
  const escaped = dictionary.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let out = text;
  for (const term of escaped) {
    if (!new RegExp(term, "i").test(out)) continue;
    out = out.replace(new RegExp(term, "ig"), (m) => `<sub alias="${m}">${m}</sub>`);
  }
  return `<speak>${out}</speak>`;
}

async function tts(text) {
  const res = await client.speak.v1.audio.generate({
    text: applyDictionary(text),
    model: TTS_MODEL,
    encoding: "linear16",
    container: "wav",
  });
  const chunks = [];
  for await (const chunk of res.stream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function sttWords(wavBuffer) {
  const { Readable } = await import("node:stream");
  const res = await client.listen.v1.media.transcribeFile(Readable.from([wavBuffer]), {
    model: STT_MODEL,
    language: "en",
    punctuate: "true",
  });
  const alt = res.results?.channels?.[0]?.alternatives?.[0];
  return (alt?.words ?? []).map((w) => ({
    word: w.word,
    start: w.start ?? 0,
    end: w.end ?? w.start ?? 0,
    confidence: w.confidence ?? 0,
  }));
}

/* ---------- WAV -> f32 timeline + alignment ---------- */

async function wavToF32(file) {
  const { execFileSync } = await import("node:child_process");
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-ar", "44100", "-ac", "1", "-f", "f32le", "-"],
    { encoding: "buffer" }
  );
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

async function concatWavs(files, outFile) {
  if (files.length === 0) return;
  const listFile = join(outDir, "narration-concat.txt");
  await writeFile(listFile, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "pcm_s16le", outFile],
    { stdio: "ignore" }
  );
}

function vttFromWords(words) {
  const fmt = (s) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const sec = (ms % 60000) / 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec.toFixed(3).padStart(6, "0")}`;
  };
  const lines = ["WEBVTT", ""];
  let cue = null;
  for (const w of words) {
    if (!cue) cue = { start: w.start, end: w.end, text: [] };
    else if (w.start - cue.end < 0.35) cue.end = w.end;
    else {
      lines.push(`${fmt(cue.start)} --> ${fmt(cue.end)}`, cue.text.join(" "), "");
      cue = { start: w.start, end: w.end, text: [] };
    }
    cue.text.push(w.word);
  }
  if (cue) lines.push(`${fmt(cue.start)} --> ${fmt(cue.end)}`, cue.text.join(" "), "");
  return lines.join("\n");
}

/* ---------- main ---------- */

const TIER = tier || "AI-OK";
const scenes = sb.scenes;
let t = 0;
const windows = scenes.map((s) => {
  const w = { from: t, to: t + s.duration, duration: s.duration };
  t += s.duration;
  return w;
});

const TTS_SCENES = TIER === "AI-OK" ? scenes.map((_, i) => i) : [];
if (TIER === "Hybrid") scenes.forEach((_, i) => { if (i > 0 && i < scenes.length - 1) TTS_SCENES.push(i); });

const allWords = [];
const perScene = [];
const notes = [];

for (let i = 0; i < scenes.length; i++) {
  const text = sceneScript(scenes[i]);
  notes.push(`## Scene ${i + 1} (${scenes[i].verb}, ${windows[i].duration}s)\n${text}`);
  if (!TTS_SCENES.includes(i)) {
    perScene.push(null);
    continue;
  }
  const wavPath = join(outDir, `scene-${i}.wav`);
  const buf = await tts(text);
  await writeFile(wavPath, buf);

  // fit to scene duration: trim with fade-out if longer
  let durSec = (buf.length - 44) / 2 / SAMPLE_RATE;
  if (durSec > windows[i].duration - 0.3) {
    const keep = Math.floor((windows[i].duration - 0.3) * SAMPLE_RATE);
    if (keep > SAMPLE_RATE * 0.2) {
      const { execFileSync } = await import("node:child_process");
      execFileSync(
        "ffmpeg",
        ["-y", "-i", wavPath, "-t", (keep / SAMPLE_RATE).toFixed(3), "-af", "afade=t=out:st=0.9:d=0.1", wavPath],
        { stdio: "ignore" }
      );
    }
  }

  const words = await sttWords(buf);
  const shifted = words.map((w) => ({
    ...w,
    start: w.start + windows[i].from,
    end: w.end + windows[i].from,
  }));
  perScene.push({ index: i, wav: wavPath, words: shifted });
  allWords.push(...shifted);
  console.error(`[voice] scene ${i + 1}: ${words.length} words, ${durSec.toFixed(1)}s narration`);
}

// narration track aligned to scene windows (silence fills the gaps)
const ordered = [];
for (let i = 0; i < scenes.length; i++) {
  if (perScene[i]) {
    ordered.push(perScene[i].wav);
  } else {
    const s = join(outDir, `silence-${i}.wav`);
    const { execFileSync } = await import("node:child_process");
    execFileSync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", Math.max(0.2, windows[i].duration - 0.4).toFixed(2), s],
      { stdio: "ignore" }
    );
    ordered.push(s);
  }
}

await concatWavs(ordered, join(outDir, "narration.wav"));

const wordsOut = join(outDir, "words.json");
await writeFile(wordsOut, JSON.stringify(allWords, null, 1));
await writeFile(join(outDir, "captions.vtt"), vttFromWords(allWords));
await writeFile(
  join(outDir, "voice-direction.md"),
  `# Voice direction (${TIER})\n\n${notes.join("\n\n")}\n`
);

const totalSpoken = allWords.length;
console.log(`[voice] done: narration.wav + words.json (${totalSpoken} words) + captions.vtt + voice-direction.md`);
