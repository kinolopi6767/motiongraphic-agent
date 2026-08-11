# UI / UX Plan — MotionGraphic Agent (Next.js)

> Premium product design for an agentic motion-graphics video engine.
> Goal: script/brief in → finished, branded, captioned MP4 out — with a review-first
> storyboard gate, deep editability, and WCAG 2.2 AA accessibility.
> Stack: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Radix.
> Companion docs: PLAN.md (roadmap), RESEARCH.md (engine), MOTION-SYSTEM.md (scene motion).

---

## 1. Positioning — what we build that competitors don't

2026 market (verified research): the category split into avatars (HeyGen/Synthesia),
cinematic generators (Runway/Veo/Kling), and workflow agents (ngram/NextDemo/Demosmith/Pexo).
Common gaps across ALL of them:

| Competitor pain point | Our answer |
|---|---|
| **Black box renders** — "generates the moment you hit enter" (Pictory, Fliki, most generators) | **Storyboard-first, review-before-render gate.** The director agent proposes scenes, timing, hooks — the user edits in plain language BEFORE any credit is spent (ngram does this; Runway Agent 2.0 proves it saves credit and trust) |
| **Template look** — stock-clip libraries per sentence (Lumen5/Pictory) | **Code-native motion verbs**: kinetic charts, count-ups, pipeline flows — deterministic GSAP compositions, never stock footage |
| **Templating feel** — same output shape every time | **Variation engine** (seeded, per-video): palette shifts, archetype rotation, pacing maps → same brief, different video every run |
| **No accessible outputs** — EAA/ADA enforcement live since Jun 2025; most tools ship captions as an afterthought | **Accessible by default**: captions baked in, audio-description rubric, keyboard-operable player, WCAG 2.2 AA baseline, VPAT-ready docs |
| **Locked to one model** (Runway-only, etc.) | **Motion-engine-agnostic**: our own HyperFrames renderer (HTML+GSAP) with pluggable model routes for footage — multi-model hub without renting credits we can't control |
| **Localization as addon** | Per-scene multilingual script + caption lanes from day one |

**Core UX promise (one sentence):**
*"Type a brief, approve a storyboard, ship a branded video — and change any word, number, or brand color afterward without re-rendering from scratch."*

Design principles that enforce it:
1. **Nothing renders blind** — every credit-consuming action has a review gate.
2. **Plain language in, structured control out** — chat-level edits re-flow the scene plan.
3. **Deterministic by default, alive by design** — seeded variation; user picks the seed family.
4. **Accessibility is a feature, not a fix** — captions/A11y shipped before export buttons.
5. **Premium restraint** — one accent, high contrast, generous whitespace, buttery micro-interactions, no dark-pattern upsell.

---

## 2. Design system

### 2.1 Visual identity
- **Theme**: deep "studio black" canvas (#0B0E13) with warm paper workspace in light mode.
  Dark is default (video tools live in dark studios); light mode fully supported, both WCAG AA.
- **Tokens** (CSS variables, light/dark dual):
  - `bg-canvas`, `bg-surface-1/2/3`, `border-subtle`, `text-hi/med/low`
  - **Accent**: electric indigo `#6366F1` (dark) / `#4F46E5` (light) — purposeful, single-accent rule.
  - **Semantic**: `success #10B981`, `warning #F59E0B`, `danger #EF4444`, `info #3B82F6`
  - **Radius**: 12px cards, 8px controls, 999px pills — consistent, calm.
- **Type**: Inter (UI + captions). Display scale: 13/16/20/24/32/40px. Headings `font-semibold`, `letter-spacing -0.01em` for display, `0.02em` for eyebrow/labels.
- **Spacing**: 4px base grid; section rhythm 24/40/64px. Max content width 1280px; studio workspace fluid.
- **Iconography**: lucide-react (stroked, 1.5px), consistent 20px interactive, 16px inline.

### 2.2 Motion language (UI, distinct from RENDERED video motion)
- 150–250ms transitions, `ease-out` cubic-bezier(0.16, 1, 0.3, 1); micro-scale 0.98→1 on press.
- Progress states: indeterminate shimmer + deterministic % where known; never fake.
- **Reduced motion**: `prefers-reduced-motion: reduce` kills all UI animation (crossfades only);
  rendered video still shows via poster frame (motion system respects its own reduced-mode later).

### 2.3 Premium differentiators (the "wow" that reads as better than competitors)
- **Living storyboard**: scene cards that ACCEPT plain-language edits inline on the card (click word → rewrite in place) — not a separate form.
- **Draft scrubber**: a filmstrip of contact-sheet frames under a timeline ruler; scrub = crossfade preview (frames cached from snapshot pass).
- **One-click variants**: "3 hooks" — director produces 3 hook options per scene (A/B/C chips on each scene card).
- **The "Why look" button**: any scene → inline annotation overlay (what moved, when, why) — trust-building transparency that no competitor shows.
- **Zero-gap re-render**: edit one scene value → re-render ONLY that scene’s segment + splice (chaptered re-edit, Phase 5).

---

## 3. Information architecture & sitemap

```
/                    marketing landing (hero = living product demo, not stock)
/login /signup       auth (Supabase; magic link + Google OAuth; no password friction)
/onboarding          brand kit wizard (3 steps: name → colors → vibe) + first brief
/app                 dashboard: projects grid, variants, credits, recent renders
/app/new             the Create flow (wizard, see §4)
/app/projects/[id]   project workspace: storyboard editor → render queue → output
/app/projects/[id]/scenes/[n]  deep scene card (inline edit detail)
/app/library         saved verbs + brand kits + reusable scene blocks
/app/jobs            render queue (live, filterable, cancellable, refund states)
/app/settings        profile, brand kits, credits, API keys, accessibility prefs
/app/settings/team   (later) seats, roles, shared kits — enterprise Phase
/app/billing         plans + usage meter + invoices
```

Global chrome (all /app routes):
- Left rail: logo, nav (Projects, Library, Jobs), bottom: credits pill + settings.
- Top bar: project name when in workspace, share button, "New video" primary CTA.
- Command palette (⌘K): jump to project, create, apply brand kit — power-user speed.
- All rail items ≥ 44px hit targets, visible focus ring (2px, offset 2, accent).

---

## 4. Core flows

### Flow A — First-run (90 seconds to a draft)
1. Landing hero: live looped example (reduced-motion fallback poster) + single input: *"Describe the video"*.
2. → `/app/new` with the brief prefilled.
3. Brand kit: name → 2–4 palette swatches (contrast-validated live) → vibe (curious/crisp/energetic) → "Looks great".
4. First brief returns → storyboard auto-drafts (see Flow B).
> Success signal: a screenshot-able storyboard within 90s of landing, zero tutorials.

### Flow B — Create from brief (the hero flow)
1. **Brief input** (textarea + attach: script, PDF, doc, URL, screenshot). Optional: duration target, ratio (16:9/1:1/9:16 — one render, three ratios), audience/channel/tone.
2. **Director agent thinks** (1–3s): emits storyboard → API validates (schema contract).
   - Storyboard card list renders: each scene = verb badge, line(s), duration, hook tag,
     microhook arrow, accent chip, contact-sheet frame placeholder.
   - **Hook A/B/C chips** per first scene (and value-bomb scene) — pick or regenerate.
3. **Review gate** (credit-free): edits in plain language on cards; director re-flows downstream.
   - "Repace": change word in line → re-prompt just that scene (agentic edit, context-scoped).
   - Timing drag on the ruler re-budgets durations; total meter stays 8–90s.
4. **Render** (credit cost shown BEFORE confirm): storyboard values → manifest → assemble → snapshot pass (contact sheets) → render → finish (grain/grade) → audio (SFX layer or VO).
5. **Output**: player (captions ON default toggle), download MP4 (+ ratios), share link, "Make variant" (clone project), "Edit scene" (back to storyboard — zero-gap re-render path).

### Flow C — Iteration loop
- Any later edit re-enters at step 3; system highlights exactly which scenes re-render.
- Version history per project (timeline snapshots; diff on values JSON).

### Flow D — Jobs & credits
- Jobs page: live rows (status chips queued→planning→snapshoting→rendering→finishing→done/failed)
  with ETA, cancel (refund on cancelled/failed), retry (same seed).
- Credits pill in rail: remaining; billing page explains cost per minute + what's free
  (storyboard, snapshots, edits are FREE; render seconds are metered).
- Failure UX: what failed, where (scene n), auto-refund, one-click retry with same seed.

### Flow E — Team share (Phase 5+)
- Review link: read-only player + comment thread pinned to scene/frame ("at 0:21 the bar color breaks hierarchy").
- Roles: admin/editor/reviewer; SSO later (enterprise).

---

## 5. Workspace spec — storyboard editor (the flagship screen)

Layout (1920–1440px): 3 columns, resizable.
- **Left · Scenes rail (320px)**: vertical scene cards (index, verb icon, first line, duration chip, A/B/C). Click = select. DnD = reorder (with keyboard fallback: alt+↑/↓).
- **Center · Stage (flex)**: preview panel = latest contact-sheet frame / draft scrubber timeline (ruler with scene boundaries, drag to scrub). Under it: values inspector as *pills* (not forms): editable text chips per value (number, label, color swatch, item list) — the most premium touch: **edit the number on the chart directly**.
- **Right · Inspector (320px)**: selected scene → verb contract fields (typed, validated live), hook/microhook text, tone. "Why look" toggle at bottom.
- Top bar inside workspace: project title, dirty state ("3 changes"), Render button with cost + ETA, Share, Version menu.
- Keyboard: ⌘S save, ⌘↩ render, ⌘K palette, arrows navigate scenes. Full keyboard path through every control (WCAG 2.1.1).

Draft scrubber details:
- Frames from `snapshot --at` pass (draft quality, ~1 frame/sec) → filmstrip thumbnails under ruler.
- Scrubbing crossfades the stage player; no hidden spinners — always shows closest cached frame + progress ring.

---

## 6. Component inventory (build order)

**Foundation**: Button (variants/loading/icon-only), Input, Textarea, Select, Stepper, Switch,
RadioCard, Tooltip, Popover, Dialog (focus-trapped, Esc, labelled), Toast (status,
aria-live polite, timer), Badge, Progress (indeterminate + determinate), Skeleton,
EmptyState (icon + action — distinguishes "no jobs" vs "no jobs of this type").
**Domain**: BriefComposer, BrandKitWizard, ColorValidator (live contrast check),
StoryboardCard, SceneDraftFrame, Scrubber, TimelineRuler, ValueChip, HookPicker (A/B/C),
CostGate (confirm modal w/ cost), RenderStatusRow, PlayerShell (captions toggle, keyboard
seek, AD track), RatioSegmenter (16:9/1:1/9:16), VersionMenu, DiffBadge, JobsFilter.
**Data**: all queries via TanStack Query (staleTime tuned per surface); server state in
Zustand only for transient UI (open panels). Forms: React Hook Form + Zod.

---

## 7. Accessibility spec (WCAG 2.2 AA baseline — non-negotiable)

> Enforcement context: EAA live since Jun 28 2025; ADA post-2024 rule; Section 508.
> We ship AA as the default config: **no accessible features live in settings**.

| Area | Committed behavior | SC |
|---|---|---|
| Contrast | Text ≥ 4.5:1 (3:1 for 24px+ & UI components ≥ 3:1 non-text); live validation in BrandKit wizard | 1.4.3 / 1.4.11 |
| Keyboard | Every control operable + visible focus ring (2px accent, offset 2, never removed); no traps; focus order = visual order; focus NOT obscured (modals take focus) | 2.1.1 / 2.1.2 / 2.4.3 / 2.4.7 / 2.4.11 |
| Screen readers | Landmarks + labelled regions; status/toast announcements via `aria-live`; form errors linked (`aria-describedby`); verbs/storyboard read as structured list; player = native `<video>` controls + roles | 4.1.2 / 4.1.3 / 3.3.1-3 |
| Captions | Generated from narration — burned by default, editable per scene; reading-speed checked (≤200wpm default clip), caption-safe zone (keep lower-third clear) | 1.2.2 |
| Audio description | Rubric: if understanding changes without visuals (charts/pipeline/on-screen text) → AD lane or narration rewritten to "describe as you go" | 1.2.5 |
| Motion | `prefers-reduced-motion` → UI animation off; auto-play NEVER default; pause/stop available; no flashing >3/s | 2.2.2 / 2.3.1 / 2.5.4 |
| Targets | Interactive ≥ 44×44px (24px minimum elsewhere, spaced) | 2.5.8 |
| Text/zoom | Reflow to 400% zoom; no horizontal scroll in app shell; 200% text (rem-based) | 1.4.4 / 1.4.10 |
| Language | `lang` on root + per-locale; voice/tone controls per scene | 3.1.1 |
| Consistency | Same component = same behavior everywhere; help discoverable (⌘K + "Help" in rail) | 3.2.3 / 3.2.6 |
| Testing | Automated (axe-core in CI on every PR) + manual keyboard pass + NVDA/VoiceOver spot checks on the 4 flagship flows before any release | — |

VPAT: keep an accessibility statement + WCAG 2.2 AA report updated per release (wevideo-style methodology; blocks any enterprise objection).

---

## 8. Next.js technical architecture

```
app/
  (marketing)/            landing, pricing, legal
  (auth)/                 login, signup, callback
  (app)/                  dashboard, new/, projects/[id]/(storyboard|scenes/[n]),
                          library, jobs, settings/..., billing
  api/
    brief/route.ts        brief -> director (LLM, retry+timeout, schema-validated)
    storyboard/route.ts   plain-language edits -> re-flow (scoped re-prompt)
    render/jobs/route.ts  create job: deductCredits (transactional) -> enqueue
    render/jobs/[id]/route.ts  status, cancel, retry
    webhooks/hf/route.ts  renderer callback (HMAC-verified, idempotent)
    mux/route.ts          playback webhooks (signed)
```

- **Data**: Supabase (Postgres + RLS + Auth + Realtime). RLS: users own projects/jobs;
  `projects`, `jobs`, `scenes`, `scene_values` (jsonb), `brand_kits`, `credits`.
- **Jobs**: BullMQ + Redis (or render.com-style persistent worker; NEVER Server Action heavy work —
  serverless timeouts kill long jobs). FFmpeg/stitch in a dedicated route with `maxDuration`
  ceiling or a worker process; reference: dreamlab pattern (dedicated stitch endpoint + secret).
- **Realtime**: Supabase Realtime Postgres changes → job row updates → live status chips
  (no polling loops; SSE fallback if provider flaky).
- **Queues/workers** (deterministic pipeline from PLAN.md): worker per stage —
  `director → storyboard-validate → assemble → snapshot → render → finish → audio`.
- **Storage**: Cloudflare R2 (zero egress); Mux or signed HLS for player (adaptive), original MP4 + ratio variants in R2.
- **Cost control**: credits ledger (deduct on submit, refund on fail/cancel — two refund points:
  submit-time failure + generation-time webhook failure).
- **Secrets**: all in env; HMAC secrets for webhooks; never in client bundles.
- **Provider abstraction**: `engine/` interface with HyperFrames renderer as the default
  engine; future: footage-model routes per scene (provider-neutral).

---

## 9. Data model sketch

```
user           id, email, brand_kit_id, credits_balance, a11y_prefs
project        id, owner, title, format_archetype, ratio[], version, seed, status
scene          id, project_id, index, verb, duration, hook, microhook, tone, frame_sheet[]
values         scene_id, jsonb (per-verb contract)
brand_kit      id, owner, name, colors[], font, vibe, caption_preset
job            id, project_id, kind (draft|final|variant), status, stage, progress, credits, error_json, seed, created_at
render_asset   job_id, ratio, url, size, duration, captions_url, ad_url
comment        id, project_id, scene_id?, frame_time, author, body   (Phase 5)
```

---

## 10. Build order mapped to roadmap

- **Phase 1 (Next)** : app skeleton, design tokens, landing, auth, /app/new brief → director → *static storyboard cards* (no live render yet); wire real render endpoint behind jobs.
- **Phase 2**: storyboard editor (value chips, A/B/C hooks, draft scrubber via snapshot pass), jobs queue + credits, brand kit wizard (contrast validation), ratio variants. = **public alpha.**
- **Phase 3**: delivery guard CLI surfaced in UI (stasis/determinism checks as pre-render badges), contact-sheet review loop, variation engine UI (seed family picker).
- **Phase 4+**: audio (SFX + VO + captions edit + AD), zero-gap segment re-render, team share/comment, settings/team, billing launches.
- **A11y**: axe CI from first PR; keyboard pass per feature; caption/AD rubrics with Phase 4; VPAT doc maintained from alpha.

*Decision log to revisit:* Supabase Realtime vs SSE (prefer Supabase; SSE fallback);
Mux vs plain MP4 (prefer signed HLS when player analytics matter, Phase 4);
pure-LLM storyboard vs rule+LLM hybrid (hybrid wins for determinism — contract linter after every director pass).