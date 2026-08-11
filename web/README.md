# Studio Web App

Next.js 16 (App Router, Turbopack) + Tailwind v4 front-end for the agentic
motion-graphics pipeline. Landing page → brief → director agent → approvable
storyboard. Renders cost credits, so the storyboard gate is the product.

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

LLM auth is automatic: `ZEN_URL` (default `https://opencode.ai/zen/v1`),
`OPENCODE_API_KEY`/`VISION_API_KEY`, or the local opencode
`auth.json`. Model override via `ZEN_MODEL`.

## Flow

1. `/` — landing. Enter a brief.
2. `/studio?brief=…` — brief composer (duration, tone, ratio 16:9 / 1:1 / 9:16).
3. `POST /api/brief` — director agent returns a validated `storyboard.json`
   (verbs from `lib/storyboard.ts`, one self-healing retry), saved to
   `web/data/storyboards/<id>.json` (gitignored dev store).
4. `/studio/<id>` — storyboard review: scene cards, hook/microhook tags,
   value chips (edit numbers/words inline), pacing meter, "why look"
   annotations, A/B/C hook alternatives on the cold-open and value-bomb
   scenes. Scene editor (PATCH) validates edits against the per-verb
   contract. `/studio/projects` lists all local storyboards with delete.
   Planning is credit-free.
5. `POST /api/jobs` — cost gate: 1 credit per 15s, debited BEFORE enqueue
   (402 on insufficient balance), auto-refunded on failure. The worker
   (`lib/render-job.mjs`) runs the pipeline with `--storyboard` (approved
   board → no re-directing) and tracks live stage (planning →
   assembling → rendering). `/studio/jobs` polls, streams the MP4
   (`/api/jobs/<id>/video`) and shows logs when done/failed.

## Structure

- `app/api/brief/route.ts` — director endpoint (Node runtime); accepts optional
  `brandKitId` — kit palette is enforced in the director prompt and recorded on
  the storyboard record
- `app/api/brand-kits/` · `brand-kits/[id]/` — brand kit CRUD (name, 2–4 hex
  colors, vibe) with live WCAG contrast validation in the wizard
- `app/api/storyboards/[id]/route.ts` — dev store: read, scene PATCH, delete
- `app/api/storyboards/[id]/clone/` — "Make variant": new id, same board, fresh seed
- `app/api/storyboards/[id]/hooks/route.ts` — A/B/C hook engineer (LLM)
- `app/api/jobs/route.ts` — cost gate + job queue (POST; optional `sceneIndex` =
  zero-gap segment re-render) + refund sweep (GET)
- `app/api/jobs/[id]/route.ts` · `[id]/video/` · `[id]/log/` · `[id]/frames/[i]/` ·
  `[id]/captions/` · `[id]/words/` · `[id]/thumbnail/` — status, MP4, log,
  contact-sheet frames, WebVTT captions, word timestamps, value-bomb thumbnail
- `app/api/config/` — voice config (Deepgram; GET sanitized / PUT / POST test)
- `app/api/config/llm-test/` — probe the configured AI model, returns token usage
- `app/api/usage/` — aggregate token usage across storyboards (by model, per board)

## AI models

One model powers the director, hook engineer, voice-tier gate and the render
pipeline (via `LLM_PROVIDER`/`LLM_MODEL`/`LLM_BASE_URL`/`LLM_API_KEY` env the
worker sets from `data/config.json`). Settings → AI model:

- **OpenCode Zen** (default, no key needed — auto-uses the opencode-go key
  attached to opencode): `deepseek-v4-flash-free` (free), `mimo-v2.5-free`
  (free), `deepseek-v4-flash` (paid — needs account credits).
- **ChatGPT (OpenAI)** — Chat Completions, sk-… key.
- **Claude (Anthropic)** — Messages API, sk-ant-… key.
- **DeepSeek** — official API, sk-… key.

Keys are stored server-side in `data/config.json` (the pipeline needs them too;
nothing sensitive goes to browser storage). Token usage is captured from every
LLM response (`usage` on storyboard records; totals in Settings → Token usage).
- `app/api/ledger/route.ts` — credits balance + transactions (local JSON)
- `app/api/data/route.ts` — reset local storyboards/jobs (credits kept)
- `lib/zen.ts` — server-only LLM client: zen (auto opencode-go key) + OpenAI +
  Anthropic + DeepSeek providers, JSON mode, token-usage capture (`chatJsonU`)
- `lib/director.ts` — director agent prompt + validation retry + hook engineer
- `lib/storyboard.ts` — contract, validation, summaries, annotations,
  delivery-guard checks (`runGuard`)
- `lib/ledger.mjs` — credits ledger (debit/credit/cost)
- `lib/render-job.mjs` — background render worker (detached child of Next).
  Chaptered pipeline: every scene renders as its own MP4 segment; full jobs
  concat all; **segment jobs re-render ONE scene and splice it into the cached
  segments of the previous done render** (verified bit-identical). Then: SFX
  bed (`src/audio.mjs`, deterministic cue kit from verb beats, −14 LUFS-ish,
  RMS report), optional Deepgram narration (`src/voice.mjs`), mux (aac),
  value-bomb thumbnail, motion guard, report.json. Prepends `<repo>/.tools`
  (static ffmpeg/ffprobe) to PATH.
- `lib/config.ts` — app config store (`data/config.json`): Deepgram voice
  (disabled by default; key never leaves the server) + LLM model picker
  (`deepseek-v4-flash-free` / `mimo-v2.5-free`), propagated to the pipeline via
  `LLM_MODEL`
- `lib/brand-kits.ts` — brand kit store + WCAG contrast math (relative
  luminance, 4.5:1 white-text / 3:1 canvas checks) used by the wizard
- `components/` — shell (⌘K palette, theme toggle, credits pill), button,
  badge, scene editor (incl. Approved toggle), values chips, why-look,
  hook picker, render cost gate

## Design

UI-PLAN tokens in `app/globals.css` (`@theme inline`): studio-black default,
paper-light via `data-theme="light"` or OS preference (theme toggle in the top
bar / ⌘K). WCAG 2.2 AA tokens; focus-visible ring never removed;
reduced-motion respected. ⌘K command palette ships on all studio routes.

## Next

- 8 motion systems (4 verbs ship today) + shader transitions
- Render-tier guard: ASR verification + caption-coverage checks when narration
  is on (needs a keyed Deepgram run to validate live)
- Team share / comments (Phase 5+, needs accounts — out of local-only scope)
