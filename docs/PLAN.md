# PLAN — Agentic Motion-Graphics Video Engine

> Script → storyboard → animated HTML (GSAP) → deterministic MP4.
> With agentic voice (Deepgram, default OFF), a YouTube-compliant delivery guard,
> and a variation engine that keeps output original, not templated.
>
> Build plan after research (see `RESEARCH.md` and `MOTION-SYSTEM.md`).

---

## 1. Product vision

A local-first engine where the user (or an agent) provides a script/brief/topic;
an LLM director structures it into a storyboard; scene agents generate highly
animated motion-graphics HTML; a deterministic renderer produces platform-ready
MP4s (16:9, 9:16, 1:1) with optional Deepgram narration, active-word captions,
and a compliance gate that guarantees no slideshow moments — engineered
specifically to survive YouTube monetization review.

## 2. Architecture

```
Input (script / brief / URL / repo)
  │
  ▼
┌────────────────────────────────────────────────────────────────┐
│ ① DISCOVERY          type, aspect, duration, energy,           │
│                      motion-system, voice (Deepgram OFF/ON),   │
│                      format-archetype (case-study / data /     │
│                      systems / timeline)                        │
├────────────────────────────────────────────────────────────────┤
│ ② RESEARCHER (opt.)  gather facts + sources for every claim;   │
│                      find the "human decision point" /         │
│                      contradiction (the editorial layer)       │
├────────────────────────────────────────────────────────────────┤
│ ③ DIRECTOR AGENT     script → storyboard.json (validated)      │
│                      [3-act arc, scenes, facts, citations]     │
├────────────────────────────────────────────────────────────────┤
│ ④ VARIATION ENGINE   seeded pick: motion system + mutation,    │
│                      transitions, layouts, drift, staggers     │
├────────────────────────────────────────────────────────────────┤
│ ⑤ SCENE AGENTS       per-scene HTML+GSAP fragments built from  │
│                      motion verbs (component library)          │
├────────────────────────────────────────────────────────────────┤
│ ⑥ ASSEMBLY (code)    combine fragments, wire data-* timing,                  │
│                      transitions, register paused timeline,                   │
│                      apply finishing stack (grain/vignette/grade              │
│                      from finish.json — seeded per video)                     │
├────────────────────────────────────────────────────────────────┤
│ ⑦ AUDIO (opt.)       Deepgram TTS per scene → STT round-trip   │
│                      → word timestamps → scene durations,      │
│                      active-word captions, beat pulses         │
├────────────────────────────────────────────────────────────────┤
│ ⑦b SFX ENGINE (opt.) silent render → cue list from motion      │
│                      beats (verb SFX tokens) → numpy-synth     │
│                      kit → mux; per-section RMS report         │
├────────────────────────────────────────────────────────────────┤
│ ⑧ DELIVERY GUARD     promise-check: no stasis >2s, motion      │
│                      tracks present, captions cover audio,     │
│                      arc intact, determinism clean             │
├────────────────────────────────────────────────────────────────┤
│ ⑨ RENDER             hyperframes lint → validate → render      │
│                      (Chromium + FFmpeg) → MP4 + WebVTT +      │
│                      thumbnail + contact-sheet review          │
└────────────────────────────────────────────────────────────────┘
  │  (review failures loop back to ⑤-⑧ with critique)
  ▼
output/<id>/video.mp4  +  subtitles.vtt  +  thumbnail.png
```

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Render engine | **HyperFrames** (`hyperframes` CLI, Apache-2.0) | Deterministic, agent-native HTML, GSAP, shader transitions, catalog |
| Animation | **GSAP 3** + SplitText (free public plugins) | Seek-safe, the ecosystem standard; allowlist-compatible |
| Heavy visuals | Optional **TypeGPU/Three.js** adapters | Particles, liquid glass — only when a scene needs it |
| Orchestration | Node 22 + TypeScript; agent runs as CLI subprocess | code2mp4 pattern; agent-agnostic (works with our own LLM calls) |
| LLM calls | Any OpenAI-compatible API (config: base URL + key + model) | Default: local opencode/deepseek/mimo; swappable |
| Voice | **Deepgram** TTS + STT (single key); default OFF | Word timestamps via STT round-trip + ASR verification; alt: Kokoro local |
| SFX | numpy-synthesized one-shot kit (produck pattern) + cue-list builder | License-clean, deterministic, no third-party audio |
| Encode | FFmpeg (via HyperFrames) | −14 LUFS / −1 dBTP normalize, loudness, mux SFX track |
| Persistence | SQLite (metadata) + filesystem (artifacts) | code2mp4 pattern |
| Frontend (later) | Minimal local web UI (project list, preview, timeline, re-render buttons) | Keep Phase 1 CLI-first |

## 4. Deliverables per video

- `storyboard.json` — editable IR (director output)
- `scenes/<id>.html` — per-scene motion source (agent output, reviewable)
- `index.html` — assembled HyperFrames composition
- `audio/` — per-scene narration + `words.json` (word timestamps)
- `subtitles.vtt` (+ optional burned captions)
- `video.mp4`, `thumbnail.png`, `contact-sheet.png` (review frames)
- `report.json` — delivery-guard results + render metrics
- `sfx/cues.json` + `master.wav` (optional SFX track; RMS per section in report)
- `sources.json` — facts/citations (editorial-value provenance)
- `finish.json` — seeded per-video grade constants (grain, vignette, tonal curve)
- `voice-direction.md` (Hybrid/Human-only tiers) — tonal markers, pauses, emphasis for a human VO

## 5. The delivery guard (compliance gate) — checks

| Check | Method | Fails → |
|---|---|---|
| **No-stasis** | Sample frames every 0.5s; pixel-diff each vs 2s prior window; also parse timeline for active tweens | Auto-retry scene with stronger ambient layer |
| **Build phase** | Parse GSAP timeline: all scene content settled by 30% of duration | Scene agent fix |
| **Motion presence** | `hyperframes keyframes` / animation-map: ≥1 animated property per clip window | Scene agent fix |
| **Captions cover audio** | Words vs scenes: every word inside a scene window; no cue crosses scene boundary | Snap boundaries |
| **ASR verification** | STT transcript vs script similarity ≥ 0.85 per line | Regenerate that scene's audio |
| **Arc intact** | storyboard: 3 acts present, hook ≤15%, payoff ≥85% | Director re-prompt |
| **Determinism** | `hyperframes lint` + contract linter (no Math.random/Date.now/repeat:-1/layout tweens) | Block render |
| **Audio standards** | loudness −14 LUFS ±1, true peak ≤ −1 dBTP | ffmpeg loudnorm pass |
| **SFX coverage** | per-section RMS report: cues fire at every verb beat, density ≤1 hit/sec, no clipped peaks | cue-engine measurement (verify by measuring, not listening) |
| **Aspect & duration** | declared vs actual; min 8s / max configured | Block render |

## 6. Retention engineering (director contract — from RESEARCH §7)

The director agent MUST encode these in storyboard.json; the schema validates them:

| Element | Rule | Source |
|---|---|---|
| Hook type | One of {pattern-interrupt, cold-open, contrarian, proof, question}; payoff claim lands ≤15s | 3-phase opening |
| Anti-hook | Skeptical-viewer acknowledgment at 8–15s (builds trust) | 7-part framework |
| Specificity | ≥3 concrete claims (numbers/names) in first 30s | Specificity test |
| Open loops | ≥2 promises of later value with defined delivery points; each resolved | Open-loop technique |
| Pattern interrupts | Every 45–90s: energy shift, direct address, "here's what most people miss", visual change | Attention cycle |
| Value bomb | Single best insight at 60–70% of duration — NOT the end | Drop-off zone |
| Re-hook | Forward-reference at 40–60% (videos >6min) | Mid-video re-hook |
| Micro-hooks | Every scene transition pulls forward (transition = highest click-away risk) | Segment arcs |
| Word budget | 130–150 words/min; segments ~250 words, never >300 | Word budgets |
| Tone markers | Each scene gets tone (curiosity/skepticism/conviction/wonder) + pacing intent (short sentences = fast cuts) | 5-act doc structure |

For documentary-format videos the director uses the 5-act shape (cold open → context →
investigation → twist → resolution) instead of a plain 3-act; the arc validator accepts both.

## 7. Voice layer (Deepgram, disabled by default — with voice economics)

- Config flag `voice.enabled` (default `false`) + `voice.provider=deepgram` + key.
- **Voice-tier gate (from RESEARCH §8):** Discovery classifies the video by trust
  threshold & emotion load → `voice-tier ∈ {AI-OK, Hybrid, Human-only}`.
  - `AI-OK` (data/news/technical): full AI narration acceptable (5–8pt gap).
  - `Hybrid` (default for documentary/explainer): AI body + human-recorded hook/outro
    (recovers 40–80% of the retention gap). Engine exports a **voice-direction script**
    (tonal markers, pauses, emphasis) + placeholder renders so the human VO can be spliced.
  - `Human-only` (emotion/story): engine outputs voice-direction script + timing grid; TTS only as reference track.
- When AI TTS is used:
  1. Per-scene TTS (Deepgram TTS or any provider) → per-scene audio.
  2. **STT round-trip on the generated audio** (Deepgram Nova, `utterances+words`) →
     word timestamps + verification transcript (solves the TTS-no-timestamps gap AND verifies pronunciation in one pass).
  3. Scene durations = audio durations + 0.4s padding; boundaries snap to word edges.
  4. Active-word captions (word highlight advances with speech) + static WebVTT.
  5. Beat pulses: text pop / background pulse on emphasized words (from word timestamps).
  6. BGM optional: ducked −12dB under narration, side-chained.
- **Pronunciation dictionary** per video (proper nouns from the researcher) injected
  into TTS and checked by ASR verification — mispronunciations cost 2–4% retention per event.
- Why Deepgram: STT word timestamps + captions helpers (`toWebVTT`) in the SDK;
  one key covers TTS + STT; Nova quality is excellent for ASR verification.

## 8. Prompt-stack (per code2mp4, pinned contract last)

1. Discovery form → 2. Identity charter → 3. MOTION-SYSTEM tokens →
4. SCRIPT system (3-act/5-act arc, retention contract §6, hook patterns) → 5. Video SKILL (scene count,
   verb choices, output checklist) → 6. Project metadata →
7. **HyperFrames contract (pinned LAST — beats all softer instructions)**
   + our determinism rules + verb library reference.

## 9. Build roadmap

| Phase | Deliverable | Done when |
|---|---|---|
| **0 · Scaffold** (✅ done 2026-08-11) | Repo layout, npm, `hyperframes@0.7.105`, vendored gsap, user-space ffmpeg 7.0.2 (johnvansickle static, no sudo), 4 motion-verb templates, deterministic `src/assemble.mjs`, Phase-1 agents (`llm.mjs`, `director.mjs`, `schema.mjs`) | hello-world + 4-verb assembly-probe render → snapshot QC pass on all 4 scenes |
| **1 · Single scene MVP** | LLM script → storyboard (1 scene) → one scene agent → motion verbs (count-up, kinetic-title, chart-race) → assembly → render | Prompt → 10s animated MP4 |
| **2 · Multi-scene + motion systems** | Director agent, storyboard schema + arc validation, 4 motion systems, transitions, variation engine v1, finishing stack (grain/vignette/grade) | Script → full 30–60s video with varied scenes |
| **3 · Delivery guard** | promise-check CLI (no-stasis, build-phase, determinism, aspect/duration, retention-contract checks) | Guard catches real violations on test corpus |
| **4 · Voice layer** | Voice-tier gate, Deepgram TTS+STT round-trip, word timestamps, captions, ducking, ASR verify, pronunciation dictionary (default OFF) | Narrated video + synced captions |
| **4b · SFX engine** | numpy-synth kit + cue list from verb beats + mux + RMS report (default ON — no narration needed) | Video with finished audio track, measured sync |
| **5 · Polish** | 8 motion systems, shader transitions, contact-sheet agent review loop (pause-test), chaptered re-edit, thumbnail, web UI | Open beta: script in → platform-ready MP4 |

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM writes invalid/non-deterministic HTML | Contract pinned last in prompts + `hyperframes lint` + contract linter + auto-retry loop with linter errors as feedback |
| Output looks templated (YouTube) | Variation engine + arc validation + per-video seeded mutations + `finish.json` per-video grade/texture; review contact sheets before render |
| AI narration drags retention | Voice-tier gate + Hybrid mode (human hook/outro) + voice-direction script export; AI voice never default |
| Render cost/time at scale | Local renders; later: HyperFrames AWS Lambda / cloud render |
| TTS price | Deepgram free tier; Kokoro local TTS as zero-cost fallback |
| Determinism vs "alive" look | Variation choices are seeded at storyboard time and baked into HTML — seeds don't violate seek-determinism |
| Model context limits | Scene agents get ONE scene + previous scene HTML only (code2mp4 pattern) |
| ffmpeg/chrome not system-wide | User-space binaries pinned: `~/.local/bin/ffmpeg` (johnvansickle static) + hyperframes own chrome-headless-shell cache — proven, no sudo |
| HyperFrames layout traps | (VERIFIED empirically). Sub-comp assets + `data-composition-src` resolve project-relative. Every scene element MUST be `position:absolute` — a bare `.clip` is shrink-to-fit and resolves 0px wide; static children ignore top/left/right. No extra positioned wrappers or duplicate CSS rules. gsap `from({autoAlpha:0})` over an inline `style="opacity:0"` stays hidden in the embedded runtime → drop inline opacity, let gsap control it. `.debug` written only with `--debug`; compile cache is content-hashed. |

## 11. Immediate next step (Phase 0)

1. `npm init` the project; install `hyperframes` CLI + gsap.
2. Port the 12 `Samples/` layouts into 4 motion-verb templates (count-up, chart-race, kinetic-title, pipeline) as the starter component library.
3. Prove the loop: one script → storyboard.json → one scene → MP4.
