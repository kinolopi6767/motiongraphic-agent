#!/usr/bin/env node
/**
 * audio.mjs — Phase 4b SFX engine (deterministic, license-clean, zero deps).
 *
 * Synthesizes a per-video one-shot cue kit in pure Node (PCM math, no numpy),
 * places cues on a timeline from verb beats, mixes with narration windows
 * (ducking −12 dB), normalizes to a −14 LUFS-ish loudness target, and writes
 * WAV files. All deterministic: same scenes + seed → same audio.
 *
 * Usage:
 *   node src/audio.mjs <storyboard.json> <out.wav> [mixWithNarration.wav] [seed]
 *
 * Cue plan (from storyboard, per PLAN §7b "cue list from motion beats"):
 *   - scene start          -> impact (soft for scenes 2+, hard for scene 1)
 *   - scene midpoint       -> ding (the data moment)
 *   - value-bomb scene     -> riser into hard impact at its start
 *   - final scene close    -> outro stamp (impact + long decay)
 *   - hook scenes          -> tick (micro-tension)
 */
import { readFile, writeFile } from "node:fs/promises";

const SR = 44100;
const RAMP = 0.01; // 10ms fade guards against clicks

/* ---------- synthesis primitives ---------- */

function fade(samples, inSec = RAMP, outSec = RAMP) {
  const n = samples.length;
  const ni = Math.min(Math.floor(inSec * SR), n);
  const no = Math.min(Math.floor(outSec * SR), n);
  for (let i = 0; i < ni; i++) samples[i] *= i / ni;
  for (let i = 0; i < no; i++) samples[n - 1 - i] *= i / no;
  return samples;
}

function envExp(samples, decaySec) {
  const decay = Math.max(1, Math.floor(decaySec * SR));
  for (let i = 0; i < samples.length; i++) {
    if (i > decay) {
      samples[i] = 0;
      continue;
    }
    samples[i] *= Math.exp(-3.5 * (i / decay));
  }
  return samples;
}

function sine(freq, durSec, amp = 0.9) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(phase) * amp;
    phase += (2 * Math.PI * freq) / SR;
  }
  return out;
}

function sweep(startF, endF, durSec, amp = 0.9) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = startF + ((endF - startF) * i) / n;
    out[i] = Math.sin(phase) * amp;
    phase += (2 * Math.PI * f) / SR;
  }
  return out;
}

function noise(durSec, amp = 1) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.25 + white * 0.75; // cheap low-pass
    out[i] = last * amp;
  }
  return out;
}

function mixAt(bed, cue, atSec, gain = 1) {
  const at = Math.floor(atSec * SR);
  for (let i = 0; i < cue.length; i++) {
    const j = at + i;
    if (j >= 0 && j < bed.length) bed[j] += cue[i] * gain;
  }
}

/* ---------- cue kit ---------- */

function cueImpact(hard = false) {
  const dur = hard ? 1.2 : 0.6;
  const body = sweep(90, hard ? 34 : 50, dur, hard ? 1.0 : 0.7);
  const crack = noise(0.05, 0.8);
  const out = new Float32Array(Math.floor(dur * SR));
  mixAt(out, crack, 0, 1);
  mixAt(out, body, 0.02, 1);
  return fade(envExp(out, hard ? 1.1 : 0.55), 0.005, 0.08);
}

function cueDing() {
  const a = sine(880, 0.9, 0.5);
  const b = sine(1760, 0.7, 0.22);
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] ?? 0);
  return fade(envExp(out, 0.8), 0.005, 0.1);
}

function cueTick() {
  const out = noise(0.06, 0.5);
  return fade(out, 0.002, 0.01);
}

function cueRiser() {
  const n = Math.floor(1.4 * SR);
  const out = new Float32Array(n);
  const nz = noise(1.4, 0.4);
  for (let i = 0; i < n; i++) {
    const f = 120 + (1200 * i) / n;
    out[i] = nz[i] * 0.6 + Math.sin((2 * Math.PI * f * i) / SR) * (0.25 * (i / n));
    out[i] *= i / n; // swell
  }
  return fade(out, 0.01, 0.01);
}

function cueStamp() {
  const out = new Float32Array(Math.floor(2.0 * SR));
  mixAt(out, cueImpact(true), 0, 1);
  mixAt(out, cueDing(), 0.25, 0.5);
  return fade(out, 0.005, 0.3);
}

/** Value-bomb scene: first scene starting inside the 60–70% window (PLAN §6). */
export function valueBombIndex(scenes, total) {
  let t = 0;
  for (let i = 0; i < scenes.length; i++) {
    const startFrac = t / total;
    if (startFrac >= 0.6 && startFrac < 0.7) return i;
    t += scenes[i].duration;
  }
  return -1;
}

/* ---------- storyboard -> cue list ---------- */

export function cuePlan(scenes, bombIndex) {
  const cues = [];
  let t = 0;
  scenes.forEach((s, i) => {
    const mid = t + s.duration / 2;
    cues.push({ at: t, kind: i === 0 ? "impact-hard" : "impact", scene: i });
    if (i === bombIndex) cues.push({ at: Math.max(t, t - 1.4), kind: "riser", scene: i });
    cues.push({ at: mid, kind: "ding", scene: i });
    if (s.hook || s.microhook) cues.push({ at: t + 0.15, kind: "tick", scene: i });
    if (i === scenes.length - 1) cues.push({ at: t + s.duration - 0.1, kind: "stamp", scene: i });
    t += s.duration;
  });
  return cues.sort((a, b) => a.at - b.at);
}

const KIT = {
  impact: null,
  "impact-hard": null,
  ding: null,
  tick: null,
  riser: null,
  stamp: null,
};

function buildKit() {
  KIT.impact = cueImpact(false);
  KIT["impact-hard"] = cueImpact(true);
  KIT.ding = cueDing();
  KIT.tick = cueTick();
  KIT.riser = cueRiser();
  KIT.stamp = cueStamp();
}

/* ---------- WAV writer (PCM16) ---------- */

export function wavBuffer(samples, sampleRate = SR) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    let v = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0);
  hdr.writeUInt32LE(36 + pcm.length, 4);
  hdr.write("WAVE", 8);
  hdr.write("fmt ", 12);
  hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(sampleRate, 24);
  hdr.writeUInt32LE(sampleRate * 2, 28);
  hdr.writeUInt16LE(2, 32);
  hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36);
  hdr.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([hdr, pcm]);
}

/** RMS of a window (0..1 scale) — drives the per-section report. */
export function rms(samples, fromSec, toSec) {
  const from = Math.max(0, Math.floor(fromSec * SR));
  const to = Math.min(samples.length, Math.floor(toSec * SR));
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

/**
 * Build the SFX bed for a full video.
 * narration: optional wav samples (aligned to the same timeline); SFX is
 * ducked to 25% under narration windows (≈ −12 dB, PLAN §7 step 6).
 * Returns { samples, rmsReport }.
 */
export function buildBed(totalDurSec, scenes, bombIndex, narration = null) {
  buildKit();
  const n = Math.floor(totalDurSec * SR) + SR; // +1s tail for stamps
  const bed = new Float32Array(n);
  for (const cue of cuePlan(scenes, bombIndex)) {
    mixAt(bed, KIT[cue.kind] ?? KIT.impact, cue.at, cue.kind === "tick" ? 0.5 : 1);
  }
  if (narration) {
    // duck SFX during narration windows (simple: gate by narration energy)
    for (let i = 0; i < bed.length && i < narration.length; i++) {
      if (Math.abs(narration[i]) > 0.02) bed[i] *= 0.25;
    }
    // narration rides on top at full level
    const min = Math.min(bed.length, narration.length);
    for (let i = 0; i < min; i++) bed[i] += narration[i];
  }
  // loudness: normalize so peak ~0.89 (≈ −14 LUFS perceived for sparse beds)
  let peak = 0;
  for (let i = 0; i < bed.length; i++) peak = Math.max(peak, Math.abs(bed[i]));
  if (peak > 0) {
    const g = 0.89 / peak;
    for (let i = 0; i < bed.length; i++) bed[i] *= g;
  }
  const report = scenes.map((s, i) => {
    let t = 0;
    for (let j = 0; j < i; j++) t += scenes[j].duration;
    return { scene: i, rms: Number(rms(bed, t, t + s.duration).toFixed(4)) };
  });
  return { samples: bed, rmsReport: report };
}

/* ---------- CLI ---------- */

if (process.env.NO_AUDIO_CLI) {
  // library mode — used by tests
} else {
const [storyboardFile, outFile, narrationFile, seedArg] = process.argv.slice(2);
if (!storyboardFile || !outFile) {
  console.error("usage: node src/audio.mjs <storyboard.json> <out.wav> [narration.wav] [seed]");
  process.exit(1);
}

const sb = JSON.parse(await readFile(storyboardFile, "utf8"));
let narrationSamples = null;
if (narrationFile && narrationFile !== "none") {
  const { execFileSync } = await import("node:child_process");
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", narrationFile, "-f", "f32le", "-ac", "1", "-"], { encoding: "buffer" });
  narrationSamples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

// deterministic noise: seed a tiny LCG so the same storyboard renders the same bed
if (seedArg) {
  let s = parseInt(seedArg, 36) || 1;
  Math.random = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const { samples, rmsReport } = buildBed(
  sb.total,
  sb.scenes,
  valueBombIndex(sb.scenes, sb.total),
  narrationSamples
);
await writeFile(outFile, wavBuffer(samples));
console.log(`[audio] sfx bed: ${outFile} (${samples.length / SR}s)`);
console.log(`[audio] rms: ${JSON.stringify(rmsReport)}`);
}
