# MOTION SYSTEM SPEC — the "100x better than samples" layer

> The samples in `Samples/` are good LAYOUTS but static slides. This spec defines
> the motion-design contract every scene must satisfy, plus the variation engine
> that keeps output from looking templated (the real YouTube risk).
>
> Scene agents MUST follow this document. The delivery guard enforces the rules
> that are machine-checkable.

---

## 1. Non-negotiable motion rules (every scene)

| Rule | Spec | Enforced by |
|---|---|---|
| R1. No visual stasis | No 2s+ window with zero animated properties in the visible region. A "camera drift" layer always runs | Promise-check (frame sampling) |
| R2. Build phase | All content on stage by 30% of scene duration | Promise-check (timeline audit) |
| R3. First-motion bias | First element to move = most important; stagger by editorial importance, not DOM order | Lint + review |
| R4. Stagger bound | Total stagger sequence < 500ms; offset first animation 0.1–0.3s | Lint + review |
| R5. Weight contrast | Slowest element ≥ 3× slower than fastest in scene | Review (animation-map.json) |
| R6. Exits faster than entrances | Exit duration ≈ 0.6× entrance duration | Review |
| R7. Exactly one ambient motion | During the breathe phase: one of {drift pan, slow zoom, pulse, rotation, color shift} — never more than one active ambient layer, or deliberate stillness only as contrast | Review |
| R8. Two focal points + three layers | Every scene: ≥2 focal elements and ≥3 visual layers (bg / mid / fg or depth parallax) | Review |
| R9. Entry easing | Entrances use `.out` eases (expo.out / power3.out / back.out); exits use `.in` | Lint (ease list) |
| R10. Deterministic | No Math.random, Date.now, repeat:-1, display/visibility tweens, layout-property tweens | `hyperframes lint` + our contract linter |
| R11. Finishing layer | Every render applies the motion system's global finish (grain + vignette + tonal grade) — never raw, untextured output | `finish.json` + assembly step |
| R12. Trend-effect ration | Trending "effect signatures" (glitch blocks, chromatic aberration, VHS, neon grids, film burn) are allowed ≤1 scene per video, only if the motion system lists them | Lint (usage count) |
| R13. Hero-moment budget | Max ONE high-energy "hero" moment per minute of video; the rest stays restrained | Review (animation-map.json) |

### The camera-drift layer (R1 engine)
Every scene gets a background "camera" element (scale 1.02) that continuously
drifts: `x/y ±10–20px` over 4–8s, or scale 1.0 → 1.05, or 0–2° rotation.
Direction/axis is randomized per scene by the variation engine so scenes never
drift identically. This alone kills the "slideshow" look.

---

## 2. Motion verbs (the component library)

Each verb is a reusable HTML+GSAP recipe with typed parameters. Scene agents
ASSEMBLE scenes from verbs — they never write raw timelines from scratch.

| Verb | Params | Use |
|---|---|---|
| `count-up` | from, to, format (int/currency/locale), suffix, pop-scale | Numbers (samples: 21,819 / 598 / 20.8%) |
| `chart-race` | values[], colors[], labels[], order | Bars grow sequentially; callout pops with `back.out` at end (samples: fork/star charts) |
| `kinetic-title` | text, split (chars/words/lines), mask, ease, stagger | Headlines reveal: mask-line or char cascade (expo.out) |
| `typewriter` | text, cursor blink, wpm | Quote/code reveals |
| `glitch-resolve` | text, intensity | Tech/data titles settle from scramble |
| `card-grid` | items[], stagger-from (center/edges), hole-pop | Card arrays (samples: SAME JOB SIX ANSWERS) |
| `pipeline-flow` | nodes[], arrows, highlight-path | Architecture diagrams animate path: input → rules → match → module (sample: reverse-skill) |
| `plane-diagram` | planes[], icons | Stacked layer diagrams build bottom-up (sample: Z3RO) |
| `comparison-split` | left[], right[], verdict | Bad-vs-good split screen with verdict stamp (sample: OPEN-KRITT) |
| `table-reveal` | rows[], highlight-row | Data tables: rows stagger in; key row highlight pulse (sample: Licences) |
| `wipe-transition` / `shader-transition` | type (wipe/glitch/blur/iris/particle), 0.5–1.0s | Scene changes — never a hard cut |
| `lower-third` | text, accent | Caption/name plates |
| `particles` | density, color | Ambient background layer (TypeGPU or CSS) |
| `gradient-shift` | stops[], duration | Slow ambient background hue drift |
| `progress-rail` | value, label | Timeline/percentage indicators |

### Text-animation standard
- Headlines: **mask-line reveal** (SplitText `type:'lines'`, mask, `yPercent:110→0`, stagger 0.1, `expo.out`) — the award-editorial look.
- Short emphasized words (SIX, FIFTH?, CHEAP): char cascade, stagger 0.02, force3D.
- Body: word reveal, `y:20, blur(4px)`, stagger 0.04, `power3.out`.
- Always wait for `document.fonts.ready`; `autoSplit:true` + `onSplit()`.
- Numbers: count-up verb with scale pop (1.0 → 1.15 → 1.0, `back.out`).

---

## 3. Motion systems (director styles)

A motion system = deterministic token set a video picks ONE of. The variation
engine rotates systems + jitters tokens per video. 8 systems:

| System | Palette anchor | Fonts | Easing signature | Transition matrix | Mood |
|---|---|---|---|---|---|
| **Editorial** | off-white/ink/one accent | serif display + mono body | expo.out / power3.out | wipe + mask-line | Journalistic |
| **Tech** | near-black/blue/cyan | geometric + mono | power3.out / back.out | glitch + shader | Product-y |
| **Neon** | black/magenta/cyan | wide display | elastic.out | bloom + particles | Nightlife |
| **Warm & Soft** | cream/amber/rose | rounded + humanist | sine.out | blur + gradient | Friendly |
| **Cinematic** | deep gray/sepia/gold | condensed caps | expo.inOut | fade-through-black + slow zoom | Film |
| **Brutalist** | white/black/hazard | ultra-heavy + mono | power4.out / steps() | hard wipe + jitter | Loud |
| **Orbital** | dark/indigo/violet | futuristic | back.out(1.4) | iris + 3D rotate | Sci-fi |
| **Organic** | paper/green/brown | hand-drawn feel | sine.inOut | smear + grain | Natural |

Each system ships: `palette.json` (bg/fg/accent/success/danger), `fonts` (Google
Fonts, self-hosted at build time), `easing-signature` (3 eases), `transition-matrix`
(per pair of scene types), `camera-drift profile`, `motion-verbs` allowed set,
`ambient-motion defaults`, `finish-profile` (grain type/amount, vignette, tone per §7).

---

## 4. The variation engine (anti-templating — real YouTube compliance)

Randomized per video (seeded so renders stay deterministic) from a fixed menu,
so channel output is never "the same video with different words":

1. Motion system choice (or system + "mutation": swap 2 tokens, e.g. accent color
   rotated ±30° hue, easing family swapped).
2. Transition choice per scene boundary (no video uses one transition type for
   every cut).
3. Scene layout archetype rotation (center-hero / left-right split / card-grid /
   pipeline / comparison / table / full-bleed-stat).
4. Camera-drift axis/direction per scene.
5. Stagger order + stagger direction (from-center vs from-start).
6. Ambient-motion type per scene.
7. Intro/outro stay IDENTICAL across a channel (YouTube explicitly allows this) —
   the BODY varies, which is the policy requirement.
8. Finish tokens: grain strength + grain type (film/paper/dust), vignette amount,
   tonal curve (contrast/temp), subtle blur pass — seeded per video so texture differs.

Seeding: `seed = hash(script) + channelSalt` → same script re-renders identical,
but different scripts never share the same motion fingerprint.

---

## 5. Narrative arc (storyboard-level rule)

The director agent MUST produce a 3-act arc; schema rejects stories without it:

- **Act 1 – Hook (0–15%):** bold claim / question / stat shock (kinetic title + glitch or mask reveal + big number).
- **Act 2 – Build (15–85%):** evidence, comparisons, architecture — 3-6 scenes of varied layout archetypes with chart/table/pipeline verbs.
- **Act 3 – Payoff (85–100%):** verdict, caveats, CTA — with a "stamp" moment (back.out pop on the key finding).

Additional storyboard fields: `facts[]` (every claim links to a source gathered
by the researcher step), `citations` (on-screen source labels — editorial value),
`tone`, `speaker` (voice persona), `word-timing` (filled later by TTS pass).

---

## 6. Scene timing budget (per ~6s scene)

| Phase | Window | What happens |
|---|---|---|
| Transition in | 0.0–0.8s | wipe/shader/glitch from previous scene |
| Build | 0.1–2.0s | staggered entrances (R2: done by 30%) |
| Hold / breathe | 2.0–5.2s | content readable + ONE ambient motion; narration lands here; numbers count-up |
| Exit | 5.2–6.0s | faster than entrance (R6), overlap with next transition |

With narration: scene duration = max(audio duration + 0.4s padding, minimum 2.5s).
Scene boundaries snap to sentence/word boundaries from the TTS word timestamps.

---

## 7. The finishing layer (human-crafted texture — from RESEARCH §9)

Applied ONCE, globally, by the assembly step (never per-scene). It is what makes
flat HTML graphics read as film/print instead of "AI render":

| Layer | Implementation (deterministic) | Notes |
|---|---|---|
| Grain | Seeded SVG/CSS noise overlay, full-frame, 4–8% opacity, animated by 1–2px offset jitter | Fixes gradient banding + "too clean" digital look; fine + consistent, never obvious |
| Texture choice | Per motion system: film grain (default), paper (tactile/editorial systems), dust (archival, intermittent) | Dust/light leaks: transitions only |
| Vignette | Radial CSS gradient, 0–15% darkening at corners | Guides attention; not on every motion system |
| Tonal grade | CSS filter stack: contrast curve, temperature shift, subtle saturation | Anchored per system palette; never crushed blacks |
| Softness | 0.3–0.5px blur pass on the whole frame | Counteracts uniform digital sharpness (the #1 AI tell) |
| Light leak | Optional, ONLY on 1–2 scene transitions | Warmth + hides cuts, motivated by edit beats |

`finish.json` = { grainType, grainOpacity, vignette, tone: {contrast, temp, sat}, blur }
seeded by the variation engine (item 8). Same video re-renders identical; different
videos differ in texture.

---

## 8. Typography discipline (readability = premium)

- Max 2 typefaces per motion system (1 display + 1 body/mono), defined in the system
  spec with motion behavior.
- Hierarchy scale (size ratio ≥ 1.6× between levels); ≥3 levels per scene when text-heavy.
- Tracking set explicitly (never browser default) — defaults are a "fingerprint".
- Phone test: smallest text legible at 1/4 screen width; motion must not reduce
  readability (no frantic jitter on body copy).
- Line length ≤ 40 chars for kinetic type (no single-line banners).
- Accent color used ONLY for hierarchy/focal points, ≤ 4 colors per palette.

---

## 9. Trend-effect blacklist (signals vs principles)

Signals (dated fast, rationed by R12): glitch blocks, chromatic aberration, VHS
overlays, neon cyberpunk grids, Y2K chrome, film burn, liquid distortion, preset
camera shake.

Principles (always allowed, the actual premium): hierarchy, contrast, rhythm,
negative space, motivated motion, consistent easing signature, one recurring
visual motif per channel (chosen at identity-charter time, e.g. a signature
transition or a repeated graphic device).

---

## 10. Motion → sound mapping (SFX tokens — from RESEARCH §10)

Every motion verb carries an SFX token. The cue engine converts these to a cue
list timed to the animation beats (whoosh ~80–120ms BEFORE the element settles,
pop ON the settle frame). Video renders SILENT; SFX is a separate muxed track.

| Verb / event | SFX token | Notes |
|---|---|---|
| Any element entrance | `pop` (pitch ±2–3 st) | the workhorse; accent alternate hits on dense staggers (anti-machine-gun) |
| Hero element / stamp / verdict | `pophard` | count-up's scale-pop, payoff stamp |
| `count-up` reach | `coin` (ascending) | character moment — people love it |
| `kinetic-title` / headline | `whoosh` → `pop` | layered: whoosh starts before settle |
| `typewriter` | `type` | light, sparse |
| `chart-race` / bar grow | `pop` cascade (climbing scale) | never equal pitches |
| `glitch-resolve` | `swish` resolve | soft — it's appearing |
| Scene transition (any) | `whoosh` | hard cuts get `thump` — ~1 per 4–6s max |
| Value-prop / resolve hold | `resolve` | warm swell |
| Confirm / checkpoint | `confirm` | ONE sound everywhere = language |
| Big reveal / act break | `thump` (+ duck others) | the loudest moment |

Rules: density ~0.8–1 hit/sec with silent gaps; sub only for hero beats; SFX
mono/centered (music goes wide); high-pass 80–150Hz. Measurement replaces
listening: per-section RMS report in `report.json`.
