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

- `app/api/brief/route.ts` — director endpoint (Node runtime)
- `app/api/storyboards/[id]/route.ts` — dev store: read, scene PATCH, delete
- `app/api/storyboards/[id]/hooks/route.ts` — A/B/C hook engineer (LLM)
- `app/api/jobs/route.ts` — cost gate + job queue (POST) + refund sweep (GET)
- `app/api/jobs/[id]/route.ts` · `[id]/video/` · `[id]/log/` · `[id]/frames/[i]/` —
  status, MP4, log, contact-sheet frames
- `app/api/ledger/route.ts` — credits balance + transactions (local JSON)
- `app/api/data/route.ts` — reset local storyboards/jobs (credits kept)
- `lib/director.ts` — director agent prompt + validation retry + hook engineer
- `lib/zen.ts` — server-only LLM client (same free line as `src/llm.mjs`)
- `lib/storyboard.ts` — contract, validation, summaries, annotations,
  delivery-guard checks (`runGuard`)
- `lib/ledger.mjs` — credits ledger (debit/credit/cost)
- `lib/render-job.mjs` — background render worker (detached child of Next);
  prepends `<repo>/.tools` (static ffmpeg/ffprobe) to PATH, snapshots one frame
  per scene midpoint (contact sheets), records seed + frames on the job
- `components/` — shell (⌘K palette, theme toggle, credits pill), button,
  badge, scene editor (incl. Approved toggle), values chips, why-look,
  hook picker, render cost gate

## Design

UI-PLAN tokens in `app/globals.css` (`@theme inline`): studio-black default,
paper-light via `data-theme="light"` or OS preference (theme toggle in the top
bar / ⌘K). WCAG 2.2 AA tokens; focus-visible ring never removed;
reduced-motion respected. ⌘K command palette ships on all studio routes.

## Next

- Zero-gap segment re-render (chaptered re-edit)
- Contact-sheet scrubber (click frames → seek preview)
- Brand-kit builder on the library page
- Render-tier guard checks on frames (no-stasis/motion) surfaced after render
