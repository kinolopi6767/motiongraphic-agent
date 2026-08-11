# RESEARCH — Agentic Motion-Graphics Video Engine

> Deep research on the ecosystem for an LLM-driven, HTML-rendered, motion-graphics
> video engine (script → storyboard → animated HTML → deterministic MP4), with
> agentic voice (Deepgram), built for YouTube monetization-safe output.
>
> Research date: 2026-08-11 · All findings verified via GitHub / web.

---

## 1. Executive summary

The entire open-source ecosystem has converged on ONE architecture:

```
LLM agent ──► storyboard JSON ──► animated HTML (GSAP) ──► headless Chromium
             frame-by-frame seek ──► FFmpeg encode ──► deterministic MP4
```

The definitive engine for this is **HyperFrames** (heygen-com/hyperframes,
~40k stars, Apache-2.0). Nobody serious reimplements the renderer; the
differentiators are the layers AROUND it:

1. **Agent orchestration** (director → scene agents)
2. **Motion systems / design tokens** (what makes output look pro, not templated)
3. **Quality/compliance gates** (deterministic checks before shipping)
4. **Audio-first timing** (TTS word timestamps drive scene timing + captions)
5. **Retention engineering** (§7) — hooks, pattern interrupts, value bomb (script-level, enforceable)
6. **Voice economics** (§8) — AI-voice retention gap → Hybrid-tier design (human hook/outro)
7. **The premium finish** (§9) — grain/vignette/grade texture layer that makes HTML read as film, not "AI render"

---

## 2. The rendering engines

| Engine | Paradigm | License | Stars | Verdict |
|---|---|---|---|---|
| **HyperFrames** (heygen-com) | HTML + `data-*` timing + seekable GSAP, captured by headless Chrome → MP4 | Apache-2.0 | ~40k | **THE engine. Ship it.** |
| **Remotion** | React components | source-available, paid >3-4 devs | ~20k+ | Fine, but HTML is more agent-native |
| **Motion Canvas / Revideo** | TS generators on canvas | MIT / MIT | ~4k | Explainers, code-first; not HTML |
| **html-video** (nexu-io) | Meta-layer with pluggable engine adapters + content-graph | Apache-2.0 | ~4.3k | Study its content-graph IR |
| **Manim** (3b1b) | Python math/3D | MIT | ~20k+ | Niche (math) |
| **scenecast** | Data-attr animations over existing HTML decks | MIT | new | Simplest possible model |

### HyperFrames — the load-bearing facts (from its own docs/skills)

**Composition contract (non-negotiable):**
- A composition = one HTML file. Root needs `data-composition-id`, timed elements need `class="clip"` + `data-start` / `data-duration` / `data-track-index`.
- Render duration = root `data-duration`. Not the GSAP timeline length.
- **Exactly one** `gsap.timeline({ paused: true })` registered at `window.__timelines["<composition-id>"]`, built synchronously at page load.
- Rendering is **seek-based**: renderer asks "what does frame 90 look like" and the answer depends only on the number 90.

**Determinism rules (breaking any = broken renders):**
- No wall clock (`Date.now`, `performance.now`, `requestAnimationFrame`, system timers)
- No unseeded `Math.random()`
- No fetching mid-render; assets load before frame 0
- No `repeat: -1` — use finite repeats computed from visible duration
- No `display` / raw `visibility` tweens (use `autoAlpha`; never on `.clip` itself)
- No tweens of `width`/`height`/`top`/`left` (layout reflows) — use transform aliases (`x`, `y`, `scale`, `rotation`) + `opacity` + `color` + `backgroundColor` + `borderRadius` + CSS vars + `innerText` counters
- No `getBoundingClientRect()` at tween time — pre-calculate layout constants at setup
- No timeline construction inside async / setTimeout / Promise

**Capabilities:**
- Sub-compositions with variables (`data-composition-variables`, `data-variable-values`) — reusable scene templates
- Runtime adapters: GSAP (default), Lottie/dotLottie, Three.js, Anime.js, CSS keyframes, WAAPI, TypeGPU/WebGPU (particles, liquid glass, shaders)
- `@hyperframes/shader-transitions` — WebGL transitions
- CLI: `init / lint / check / snapshot / preview / render / publish / doctor / keyframes`
- Agent skills: hyperframes-core, hyperframes-animation, hyperframes-keyframes, hyperframes-creative, hyperframes-cli, figma import
- Catalog of reusable blocks (transitions, captions, charts, maps)
- Rendering: local, Docker, AWS Lambda, HeyGen cloud
- Audio: `data-volume`, media owned by framework, tween `volume` for fades/ducking

**Key GSAP patterns allowed (from hyperframes-animation):**
- Counter: `gsap.to(el, { innerText: 100, snap: { innerText: 1 } })` or proxy form with `toLocaleString` + separate scale tween for grow effect
- Volume fades: `tl.to("#bgm", { volume: 0 })` for ducking
- `animation-map.json` diagnostic: audits choreography (dead zones, stagger consistency)

---

## 3. Agent-pipeline patterns (the orchestration layer)

### code2mp4 — the best blueprint we found

**7-layer prompt stack** (order matters; contract pinned LAST so it beats softer rules):
1. Discovery — interactive turn-1 question form (type, aspect, duration, energy)
2. Identity — compact producer identity charter (~200 chars)
3. Motion System — `MOTION.md` (palette, fonts, easing, transitions) per style
4. Script System — `SCRIPT.md` (narrative arc, pacing, hook patterns)
5. Video Skill — `SKILL.md` (scene counts, animation patterns, output checklist)
6. Project Metadata — user-selected dims
7. Contract — HyperFrames load-bearing rules

**Pipeline:** Director Agent (2K-char prompt) → structured storyboard JSON →
per-scene Scene Agents (1K prompt each, given: brief + storyboard + scene spec +
previous scene's HTML for continuity) → pure-code assembly (`assembleComposition()`:
combine fragments, insert transitions, set `data-start`/`data-duration`, write index.html).

**Storyboard JSON shape:**
```json
{
  "title": "...", "duration": 30, "aspectRatio": "16:9",
  "scenes": [{
    "id": "problem", "duration": 7, "goal": "...",
    "visual": "...", "text": "...", "motion": "Typewriter reveal with cursor blink",
    "audio": "Subtle tension drone"
  }]
}
```

**HyperFrames bridge commands:** `lint --json` (structure), `validate --json`
(Chrome runtime), `inspect --json` (visual audit: overflow/clipping/contrast),
`render --format mp4`, plus `tts`, `transcribe`, `remove-background`.

**Persistence:** SQLite (metadata) + filesystem (artifacts, `projects/<id>/output.mp4`).
SSE for streaming agent output and render progress.

### html-video (nexu-io)
- **Content-graph IR**: nodes (entity/data/text) + edges (sequence/dependency/contrast), topo-sorted into frame order & timing — this handles "article → multi-scene video" better than naive scene lists.
- Engine-adapter meta-layer: `render(input, ctx)` contract; HyperFrames adapter shipped, Remotion/Motion Canvas planned.
- 21 curated, license-clean templates; per-frame HTML on disk; AI soundtrack (MiniMax) mixed at export.

### Orkas-VideoStudio
- `plan.json` editable IR; per-segment re-render.
- **Delivery guard (`ovs plan promise-check`)** — verifies the finished cut keeps its promise (e.g. "real motion, not a silent slideshow") BEFORE shipping. ← This is the pattern for our YouTube compliance gate.
- Zero-key compose trunk; BYO keys for image/video/TTS.

### AutoMotion (LangGraph)
`parse_url → fetch_github_data → analyze_repo → write_script → generate_voice →
calculate_frames → render_video`
- Per-scene ElevenLabs TTS → concatenate → **ffprobe durations → exact frame counts at 30fps** (compensating 12-frame transition overlaps) → Remotion render → `video.mp4` + `subtitles.vtt` + thumbnail.
- Lessons: TTS-first timing is the reliable sync method; measure real audio durations, never estimate.

### speechlab0210/video-production-skill (battle-tested, 40+ videos)
- Script → slides (or HTML) → ElevenLabs TTS → **Whisper ASR verification** (similarity ≥ 0.85 per line) → FFmpeg assembly → aligned subtitles.
- **Word-level timestamps from ASR, not from TTS**, to align captions — "won't drift, won't cut English words".
- Ships `lessons-learned.md` — the single most valuable doc in the space.

### llm-video-maker (GoldLegendW80)
- `/make-video` + `/edit-video` skills; brief schema `{id, platform, story, source}`;
- Kokoro local TTS (offline, no key); platform aspect ratios; license-tracked assets vendored locally; chaptered re-edit.
- **Chaptered editing** (re-render one chapter) is a nice future feature for us.

---

## 4. YouTube monetization research (CRITICAL correction to common belief)

### What the policy actually says (July 15, 2025 update)
- "Repetitious content" was **renamed "inauthentic content"** — to clarify it covers mass-produced/repetitive content.
- Three clarified non-monetizable categories:
  1. **Generic or Repetitive Content** — "content that looks like it's made with a template"; explicitly names: *"Image slideshows, templated storylines, or scrolling text with minimal or no narrative, commentary, or educational value"* and *"AI-generated content made with generic or unoriginal templates... without adding the creator's original, authentic insights or perspective."*
  2. **Unsatisfying or Off-putting Content** — emotionally manipulative formulas, shock-bait, "stitches together unrelated or inconsistent AI clips".
  3. **AI Personas on sensitive topics** (health, legal, finance, politics).

### The "2-second rule" is a myth (as policy)
There is **no policy rule about 2 seconds per static image**. It's a community
heuristic. The policy evaluates:
1. Is the content **original and valuable**?
2. Does it mislead or cause harm?
3. Copyright / advertiser / community rules.

### What actually protects a channel
- **Per-video variation** — same intro/outro is explicitly fine; the BODY must vary. "Videos that feel interchangeable from video to video" are the target.
- **Narrative arc / logical progression** required.
- **Editorial value**: real facts, citations, commentary, original insight — not just reworded trending topics.
- **A creative fingerprint**: recognizable production style + original perspective. "If you're just feeding prompts and uploading whatever comes out, you don't have a creative fingerprint."
- **Synthetic/altered content checkbox** — required when content could be mistaken for real; it exists to prevent harm, not punish AI.
- Enforcement is **channel-level**; you can reapply after 30 days.

### Engineering implications for us (turn policy into code)
1. **Variation engine (anti-templating)**: each video must differ materially — randomized per-video palette shifts, transition choices, layout archetypes, motion signatures, pacing maps. Same structure ≠ same video.
2. **Narrative arc enforcement**: director agent must output a 3-act structure (hook → build → payoff); storyboard schema validates it.
3. **Motion = engagement ≠ compliance**: animation alone doesn't satisfy policy (a fully-animated templated video is still "generic"). Animation is necessary for retention, but the compliance lever is **substance + variation + arc**.
4. **Frame-level motion guarantee** is still valuable: no clip/transition may exceed ~2s of visual stasis, because retention collapses and it makes the video look like a slideshow (policy's named example). Keep it as a **delivery-guard check**, not as "the policy".
5. **Originality metadata**: keep per-video provenance (facts + sources gathered by a researcher agent) so every claim is grounded — this is "editorial value" in practice.

---

## 5. Voice / TTS research (Deepgram focus)

### Deepgram capabilities (verified)
- **STT (Nova 2/3)**: `utterances=true` returns segment-level + **word-level timestamps** (`words[].start/end`); `diarize=true` adds speaker labels; `smart_format=true` normalizes punctuation/numbers.
- **Caption generation**: Node SDK has built-in `response.toWebVTT()` / `response.toSRT()`; Python has `deepgram-python-captions` (DeepgramConverter, line-length chunking, speaker breaks).
- **TTS**: has TTS API + WebSocket streaming (voice agents). **Known gap: TTS streaming does NOT return word timestamps** — open issue deepgram-js-sdk#394 (product team aware; Cartesia/ElevenLabs have it).

### The reliable word-timestamp pattern (used by production pipelines)
```
TTS (any provider: Deepgram, ElevenLabs, Kokoro-local)
  → audio per scene
  → STT round-trip (Deepgram Nova / Whisper-timestamped / whisper.cpp)
      → word-level timestamps
  → drives: scene durations, active-word captions, beat-synced motion
  → ASR verification: transcript vs script similarity ≥ 0.85 (catch mispronunciations)
```
This is a **feature, not a workaround**: the ASR pass simultaneously gives you
timestamps AND verification, and works with ANY TTS backend. Deepgram gives this
in one API (TTS + then STT on the same key).

### Audio engineering for platform readiness
- Normalize to **−14 LUFS, −1 dBTP** (YouTube/Spotify standard) — llm-video-maker and video-mcp both do this.
- Side-chain duck BGM under narration (video-mcp pattern).
- TTS per scene, then concatenate + measure with ffprobe — never estimate durations.

---

## 6. Motion-design research (the "100x better" layer)

### Principles (devsvideo HyperFrames GSAP guide — distilled)
- **Easing is emotion**: `expo.out` = confident (headlines/hero), `power3.out` = professional, `sine.inOut` = dreamy, `back.out(1.7)` = playful, `elastic.out` = tactile. Never ease-in for entrances / ease-out for exits.
- **Timing is weight**: 0.15–0.3s featherweight (badges), 0.3–0.5s standard, 0.5–0.8s heavyweight (hero), 0.8–2.0s cinematic. **Slowest element ≥ 3× slower than fastest** or nothing has weight.
- **Stagger = hierarchy**: first element to move reads as most important (stagger by editorial importance, NOT DOM order); overlap entries; **total stagger sequence < 500ms**.
- **Scene rhythm**: cast fully on stage by ~30% of scene duration; offset first animation 0.1–0.3s (never t=0); exits faster than entrances (asymmetry: 0.4s in / 0.25s out).
- **Ambient motion**: exactly ONE per scene during the "breathe" phase (slow pan 10–20px over 4–8s, scale 1.0→1.05, 0–2° rotation, or deliberate stillness as contrast). More than one = circus.
- **Every scene needs 2 focal points and 3 visual layers** — never a single centered text block.

### Anti-patterns (the "10 tells" that scream AI-generated)
Same ease everywhere · same duration everywhere · same entry direction · same stagger rhythm · ambient zoom on every scene · starting at t=0 · dumping all elements at once · ease-in entrances · ease-out exits · single centered text block.

### Kinetic typography patterns (GSAP SplitText)
- **Mask line reveal** (award-level editorial look): split by lines, wrap in `overflow:hidden` masks, slide `yPercent: 110 → 0`, stagger 0.1, `expo.out`.
- **Char cascade** for short headlines: stagger 0.02 (20ms), total cascade < 1s.
- **Word reveal with blur**: `y:20, blur(4px)` for body copy.
- **Scramble/glitch resolve**: chars cycle random glyphs → settle (technical/data contexts).
- Wait for `document.fonts.ready` before splitting; `autoSplit:true` + `onSplit()` for re-splits; `force3D:true`; revert on cleanup; respect `prefers-reduced-motion`.
- **Count-up numbers**: `gsap.to(el, { innerText, snap })` — pairs with a scale pop.

---

## 7. Retention & script science (what actually keeps viewers)

### Attention data (2025–2026, multiple sources)
- Average YouTube video retains just ~23.7% of viewers to the end; **>55% drop in the first 60s**.
- Steepest drop: seconds 10–20, inflection ≈ second 15. First 30s is the decision window.
- 50–60% AVD is the range where the algorithm recommends; "intro retention" is the first metric to watch (channels >65% past minute 1 = +58% AVD for the rest).
- Human attention cycles: high engagement ~45–90s, then a novelty dip → **pattern interrupts must be scripted at that cadence**.

### The opening (0–30s) — three phases
1. **Pattern interrupt (0–5s):** break scroll momentum — bold claim, unexpected visual, on-screen statement, question.
2. **Payoff promise (5–15s):** specific value claim lands by second 15 (the "payoff-at-15" test).
3. **Commitment hook (15–30s):** info gap / proof / story opening / demonstration start.

Seven opening patterns that burn retention: generic greeting, logo bumper before content, meta-commentary ("in this video we're going to..."), slow context build, apology/disclaimer, engagement ask before value, clichéd openers ("have you ever wondered...").
**Specificity test: ≥3 concrete claims (numbers/names) in the first 30s.**

### The 7-part retention framework (storyflow.so)
Hook (0–8s) → **Anti-hook (8–15s:** acknowledge skepticism, build trust) → Promise (15–30s) →
Preview with open loops → Core content with **pattern interrupts every 45–90s** →
**Value bomb at 60–70%** (right before the typical drop-off zone; best insight placed here, NOT at the end — 70% of viewers never reach the conclusion) → Soft CTA (final 10%, future-video hook, no begging).

### Documentary 5-act structure (YouTube-tightened, 8–15 min)
1. **Cold open (60s):** most compelling moment, no context; pose the central question, don't answer.
2. **Context (~2.5min):** background, players, stakes; **weave micro-hooks** ("but none of that explains what happened in 2023"), never info-dump.
3. **Investigation (~4min):** evidence as a **sequence of reveals**; "you'd think X… but actually Y" — expectation-and-subversion is what makes it addictive.
4. **Twist (~2min):** the complication that re-engages viewers at the 6–8min mark (a "second hook").
5. **Resolution (~1.5min):** answer the question, **reframe it**, end with a lingering implication.

Supporting rules: every video has ONE central question ("why did X happen?"); facts inform, emotions engage; **sentence pacing = cut pacing** (short sentences = fast cuts, e.g. in the twist); tonal shifts (curiosity, skepticism, conviction) — never a flat "blog post read aloud".

### Word budgets
- 130–150 words per minute of narration.
- Segments >300 words show measurable retention dips (target ~250).

### Engineering implications (what the engine must encode)
- Director agent outputs, in storyboard.json: hook type, anti-hook line, open loops (promise + delivery point), pattern-interrupt beats every 45–90s, value-bomb placement at 60–70%, mid-video re-hook (40–60%), micro-hooks at segment transitions (transitions are the highest click-away risk).
- Scene transitions function as micro-hooks (pull forward, never a "stopping point").
- Schema validation checks these placements (like the arc check).

---

## 8. Voice economics — AI vs human narration (the data)

### Measured gap (multiple controlled tests, 2024–2026)
- Same script/visuals, only voice varies: **AI narration lost ~13 retention points at halfway** (34% vs 47%); AVD −21%.
- Median RPM across 1,247 monetized channels: human-only $8.42 / hybrid $6.91 / AI-only $4.27 (124% premium for human); subscriber conversion 3.8% vs 1.4%; return-viewer rate 22% vs 8%; suggested-video impressions −31% for AI-only channels.
- "Retention cliff" hits at **15–45s**: viewers unconsciously detect the missing micro-expressions of speech (breath before a key point, acceleration when excited, the pause that signals a shift in thought) — "a human narrator communicates subtext; an AI narrator communicates text."

### Where AI voice is acceptable
- Information-driven content: data presentations, news roundups, technical explainers, tutorials — gap narrows to 5–8 points; visuals carry the engagement ("voice is a convenience, not the experience").
- Coding/technical niche: viewers could identify the AI voice 62% of the time, but 44% preferred it; subscribe split ~50/50 — content quality outweighed voice source.
- Storytelling/emotion-heavy niches: gap is disqualifying (satisfaction delta 35% vs 8%).

### The hybrid method (highest ROI)
- **Human hook + outro, AI body** recovers 40–80% of lost retention vs fully AI ("human sandwich" / trust signal).
- Voice cloning is the middle ground: ~30 min of clean source audio; keeps identity; local cloning removes privacy concerns.
- Mispronunciations cost 2–4% retention per event → pronunciation dictionary is mandatory.
- Verbal disclosure of AI voice use measurably reduces pushback.

### Engineering implications (why voice stays OFF by default — and what we add)
1. **Voice-tier gate in Discovery**: content type → {AI-OK (info/data), Hybrid (human hook/outro + AI body), Human-only (emotion/story)} — default Hybrid for documentary-format videos.
2. **Script carries voice direction**: tonal markers (curiosity/skepticism/conviction), pause/emphasis markers, sentence-pacing intent — so the same script works for AI TTS and a human VO.
3. **Pronunciation dictionary** per video (proper nouns from research) + the existing STT/ASR verification catches mispronunciations.
4. Hybrid mode = render with placeholder AI voice + export **voice-direction script** so a human can record hook/outro, then splice.

---

## 9. The premium finish — making output read as human-crafted

### What makes AI/digital output read as "synthetic"
- **Uniform sharpness** (every edge at max acutance, pore-less surfaces) — the #1 tell.
- "Too clean": no texture, banding in gradients, default fonts/colors/easings ("default settings are a fingerprint").
- The correction, in order: light blur → fine grain → grade toward concrete references (never adjectives).

### The professional checklist (pause-test etc.)
- **Pause test:** can you stop on any frame and instantly point to the main message?
- Composition: consistent margins, grid alignment, purposeful negative space ("crowding is the fastest way to look cheap").
- Typography: passes the phone test; controlled line length; ≤2 faces and few weights; **motion must not reduce readability**.
- Color: intentional, not "default nice"; blacks not crushed; grade with scopes/quantified references (e.g. an 85:15 dark-to-light ratio).
- Easing consistent per piece; **motion blur on fast moves only**; effects must have a job.

### The finishing stack (the "look glue")
1. **Tonal consistency** (contrast first, then color — per motion system).
2. **Unified texture**: grain = fine, consistent, "almost boring" — fixes banding AND digital-clean; paper texture behind type plates for tactile explainers; light leaks ONLY as transitions; dust only for archival looks, intermittent.
3. **Edge control**: vignette to guide attention (not on every shot), mild bloom, no sharpening-for-style.
4. **Motion polish**: varied easing, motivated blur, no repeated "one nice move stamped everywhere".
5. **Centralized final pass**: one global adjustment layer for the whole video.

### Trends age badly — principles age well
- Dated fast: glitch blocks, neon cyberpunk grids, exaggerated chromatic aberration, VHS overlays, Y2K chrome, film burn, liquid distortion — the "plugin fingerprints" of an era.
- Durable: hierarchy, contrast, rhythm, spacing, readability, **motivated** motion. "One strong moment per minute reads intentional; five reads like a pack demo."

### Anti-templating aesthetics (channel identity)
- ≤4 colors used consistently; ONE timing signature (easing fingerprint) per channel; a recurring visual motif; ≤2 typefaces with defined motion behavior; texture as a differentiator. "AI is a structural tool; the creator owns the style decisions."

### Engineering implications
- Every motion system ships a **finishing stack**: grain overlay (SVG/CSS noise, seeded), vignette, CSS-filter grade — applied as global layers in the composition, not per-scene.
- Verb library excludes trending "effect signatures"; glitch etc. are reserved and rationed (≤1 use per video).
- Typography tokens per system: face count, tracking, min size, hierarchy scale (motion must respect readability).
- Deliverable `finish.json`: per-video grade constants (grain strength, vignette, tonal curve) — seeded by the variation engine so texture differs per video.
- The contact-sheet review includes the pause-test: reviewer must be able to identify the focal point on each sampled frame.

---

## 10. Sound design (the layer that makes animation "feel finished")

### The canonical pattern (produck demo-studio, battle-tested 40+ videos)
1. **Render the video SILENT** (HyperFrames) — never bake audio into the composition.
2. Ship a **KIT** of clean one-shot `.wav`s — one file per sound *type*, short, dry,
   peak-normalized. The kit is **synthesized with numpy** (no samples, no licensed
   files → license-clean to ship AND reuse). Synthesis is the right tool: dry percussive
   one-shots are exactly what text-to-audio models return near-silent on.
3. Write a **CUE LIST as a data file**: `(time_seconds, token, gain_dB, semitones)` per
   hit, timed to exact animation beats; a script trims, pitch-shifts, gains, sums,
   soft-limits → `master.wav` muxed onto the render.
4. **Verify by measuring, not listening**: print per-section RMS/peak; extract a frame at
   each hit to confirm sync.

### Motion → SFX mapping (the canonical table)
| Animation | Sound | Notes |
|---|---|---|
| Element pops in | **pop** (pitch-varied) | the workhorse, ~75% of cues |
| Hero element / CTA | **pophard** | lower/harder pop |
| Click / cursor / checkbox | **click** (+ tiny **thump** for "press") | |
| Scene transition / panel in | **whoosh** | |
| Hard cut / big reveal | **thump** | ~1 per 4–6s only |
| Box/arrow draws | **swish / drag** | soft — it's appearing |
| Counters | **coin** (ascending pitch) | one of the few "character" sounds |
| Typing | **type** | light, sparse |
| Confirm / saved / live | **confirm** (warm, muffled, percussive) | ONE sound reused everywhere = a language |
| Value-prop resolve | **resolve** | warm swell, not a tick |
| Notify | **ding** | |

### Mixing rules
- **pop = the landing, whoosh = the motion** — layer them: whoosh starts ~80–120ms
  before the element settles, pop lands on the settle frame (envelope matches easing curve).
- Vary pitch ±2–3 semitones on repeats; cascades climb a scale (anti-machine-gun; accent
  alternate hits when many items appear fast, e.g. 12 cards → ~6 prominent at −14/−19dB).
- **Density ~0.8–1 hit/sec**; keep silent gaps — wall-to-wall SFX sounds cheap.
- Impacts only on hard cuts; duck sounds around a boom so it dominates.
- SFX mono/centered; music bed goes wide so SFX cut through. Sub only for hero beats
  (high-pass everything else 80–150Hz — translates on phone speakers).
- UI transient specs: attack 0.5–5ms, exponential decay 30–150ms (clicks) to 150–400ms
  (whooshes); **true peak ≤ −2 dBTP** for transient assets (−3 if re-encoded); loudness
  tiers: subtle −32..−26 LUFS, confirm −28..−22, warn −24..−18; sync within ±20ms of the
  visual event; midrange anchors 500Hz–2kHz (survives bad speakers).
- **SFX = punctuation, music = mood, VO = message.** Sidechain a 2–5kHz notch into SFX
  under VO phrases; BGM ducked −12dB under narration.
- Music licensing: **YouTube Audio Library = copyright-safe**; Creative Commons requires
  attribution; Creator Music = rev-share alternative.

### Engineering implications
- New pipeline step: after render, an **SFX cue engine** maps storyboard beats + motion
  verbs → cue list → synthesized kit → mux (produck pattern). Fully deterministic,
  license-clean, measurable (per-section RMS report becomes a delivery-guard check).
- Motion verbs carry SFX tokens (see MOTION-SYSTEM §10) so scene agents can't forget audio.

---

## 11. Faceless documentary channels — format archetypes (the market we target)

### The shared stack (ColdFusion, MagnatesMedia, Economics Explained, PolyMatter, Wendover, Company Man, ...)
Research-heavy script → VO narration → b-roll/charts/maps/motion graphics → no face →
advertiser-friendly topic. **Production value is a multiplier on research, not a
substitute** (Company Man: millions of subs on stock photos + simple animations).

### Channel archetype table (what to COPY per lane)
| Archetype | Exemplars | Visual engine | Cadence/cost | Fit for our engine |
|---|---|---|---|---|
| Cinematic documentary | ColdFusion (5.2M subs) | Archive b-roll, calm narration, restrained on-screen text | Slow, premium | Partial (b-roll not our lane) |
| Rise-and-fall thriller | MagnatesMedia | Animated maps + archive, high tension | Slow | Partial |
| Chart/data-led | Economics Explained, Wall Street Millennial | Charts, filings, motion graphics | Medium | **Best fit — pure motion graphics** |
| Systems explainer | How Money Works, PolyMatter | Custom animation, diagrams | High cost | **Best fit — our verb library** |
| Volume research | Logically Answered, Company Man | Stock photos, simple | Fast | Weak (looks cheap) |

ColdFusion lessons: **tone is the product** (measured delivery = authority); every story
has a **central question** + "the human decision point" (the layer beyond a Wikipedia
summary — editorial judgment); ~1,800-word scripts, 9–12 min episodes, 3–4/month;
restraint in on-screen text.

### Engineering implications
- Discovery gains a **format archetype** dimension: `{case-study, data-explainer,
  systems-explainer, timeline, ...}` → picks the visual engine (chart-heavy vs
  diagram-heavy), scene templates, and tone tokens. Our engine's edge = the
  chart/data + systems lanes, where motion graphics ARE the visual engine.
- **Editorial value = the differentiator**: researcher agent must find the "human
  decision point" / contradiction per story (not just facts) — this is the
  authenticity lever for monetization (RESEARCH §4).

---

## 12. Missing-piece checklist → now covered by our PLAN

| Missing piece (identified earlier) | Where it's solved now |
|---|---|
| Motion/design system the LLM must follow | `MOTION-SYSTEM.md` spec + per-video randomized variation engine |
| Delivery guard (no static >2s, sync, captions covered) | Promise-check CLI: static analysis + frame sampling + audio coverage audit |
| Audio-first timing | TTS → STT round-trip word timestamps → scene durations/captions/beats |
| Narrative arc + originality (the REAL YouTube compliance) | Storyboard schema requires 3-act arc; researcher agent grounds facts; variation engine |
| Reuse of proven renderer | HyperFrames (never reinvent) |
| Agent workflow | code2mp4-style 7-layer prompt stack, Director → Scene Agents → pure-code assembly |
| Retention engineering (hooks, pattern interrupts, value bomb) | §7 research → director contract in PLAN §6: storyboard must encode hook type, anti-hook, open loops, interrupts every 45–90s, value bomb 60–70% |
| Voice economics (AI-voice retention gap) | §8 research → PLAN §7: voice-tier gate (AI-OK/Hybrid/Human-only), hybrid mode, voice-direction script, pronunciation dictionary |
| The "premium finish" (anti-AI-look texture) | §9 research → MOTION-SYSTEM §7: per-system finishing stack (grain/vignette/grade), trend blacklist, typography discipline, `finish.json` |
| Sound design (SFX make animation feel finished) | §10 research → PLAN: post-render SFX cue engine (silent render → numpy-synthesized kit → cue list → mux), verbs carry SFX tokens (MOTION-SYSTEM §10), RMS report = guard check |
| Format archetypes (what market lane to serve) | §11 research → Discovery `format-archetype` dimension (case-study / data-explainer / systems-explainer / timeline); researcher finds the "human decision point" per story |

---

## 13. Source list

- https://github.com/heygen-com/hyperframes (engine + skills + catalog)
- https://hyperframes.heygen.com/ (concepts: compositions, determinism, GSAP guide)
- https://github.com/code2mp4/code2mp4 (architecture.md: 7-layer prompts, Director/Scene pipeline, hyperframes bridge)
- https://github.com/nexu-io/html-video (content-graph, engine adapters, 21 templates)
- https://github.com/Orkas-AI/Orkas-VideoStudio (plan.json IR, delivery guard)
- https://github.com/JawadGigyani/AutoMotion (LangGraph + TTS-first frame math)
- https://github.com/speechlab0210/video-production-skill (ASR verification, lessons-learned)
- https://github.com/GoldLegendW80/llm-video-maker (skills, chaptered edit, Kokoro)
- https://github.com/tyevco/glissade · https://github.com/ybouane/VideoFlow · https://github.com/vosjs/vos (alternative IR models)
- https://github.com/midrender/revideo · https://github.com/motion-canvas/motion-canvas
- YouTube: https://support.google.com/youtube/answer/1311392 (inauthentic content policy, 2025-07-15 update)
- vidIQ: https://vidiq.com/blog/post/youtube-reused-content-policy-guide/ (2026-02)
- Tubefilter 2026-07-14 (three categories clarified)
- Deepgram: developers.deepgram.com (TTS websocket, STT timestamps, captions), deepgram/deepgram-python-captions, deepgram-js-sdk#394 (TTS word timestamps gap)
- GSAP: gsap.com docs (Staggers, SplitText); devsvideo.com/hyperframes-gsap-animation-principles; annnimate.com/learn/text/split-text-reveal
- Retention/scripts: channel.farm/blog/documentary-style-ai-video-scripts-youtube (5-act structure, word budgets); storyflow.so/blog/youtube-video-script-template-7-part-framework-retention-2025 (7-part framework, value bomb 60–70%); learn.tubeai.app (23.7% avg retention, hook engineering, pattern interrupts); prepublish.ai (first-30s playbook: 3-phase opening, payoff-at-15, specificity test; segment word budgets); studiobinder.com/blog/script-writing-on-youtube (hook/setup/payoff, AIDA/PAS)
- Voice economics: customclanker.com/ai-voiceover-youtube (47% vs 34% halfway retention test); allin1panel.com AI-vs-human tests (AVD 6:42 vs 5:15, hybrid recovery ~40%); alibaba.com/product-insights (1,247-channel RPM table: $8.42/$6.91/$4.27, hybrid tiers); vidno.ai/blog/ai-narration-quality (62% detect, 50/50 subscribe split in coding niche); milx.app AI-vs-human earnings; plugostudio.com (dubbing AVD gap); kw.media (autodubbing retention data)
- Premium finish: wedesignmotion.com (pro checklist; overlays: grain/dust/leaks/paper; effects that age well; 5-layer finishing stack); invideo.io/blog/ai-video-post-production (blur→grain→grade order, uniform sharpness = synthetic tell); tapvid.ai/blog/niche-motion-graphics-style-guide (niche aesthetic, texture as differentiator); aethera.ai/blog/motion-graphics-design-brand-system (restraint, one strong moment per minute); wettonco.com (grid, legibility vs narrative)
- Sound design: github.com/tryproduck/produck-skills/blob/main/skills/demo-studio/docs/SOUND.md (silent-render + synth kit + cue-list pattern, motion→SFX mapping, mixing rules); sonusgearflow.com/sounddesign/abstract-sounds-design-for-motion-graphics (transient/tone/tail, pitch families, two reverbs); sonusgearflow.com/musicproduction/designing-transitions-ui-and-feedback-sounds (UI transient specs: dBTP, LUFS tiers, ±20ms sync); motiontheagency.com/blog/sound-design-for-explainer-videos (VO/SFX/music layers); sfxengine.com/blog/after-effects-sound-effects-tutorial
- Channel archetypes: outlierkit.com/resources/faceless-business-documentary-channels/ (format teardown table); faceless.my/youtube/faceless-finance-documentary-channels/ (stack + what-to-copy); facelesschannels.net/coldfusion-youtube-channel-case-study/; coldfusioncollective.com/about; yespress.io/dagogo-altraide (editorial judgment, human decision point)
