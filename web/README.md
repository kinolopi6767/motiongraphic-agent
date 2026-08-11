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
2. `/studio?brief=…` — brief composer (duration, tone, ratio).
3. `POST /api/brief` — director agent returns a validated `storyboard.json`
   (verbs from `lib/storyboard.ts`, one self-healing retry), saved to
   `web/data/storyboards/<id>.json` (gitignored dev store).
4. `/studio/<id>` — storyboard review: scene cards, hook/microhook tags,
   values JSON, pacing meter. Per-scene editor (PATCH) with contract validation
   for values, duration, hooks and tone; "Why look" annotations explain each
   scene's retention role. `/studio/projects` lists all local storyboards with
   delete. No credits spent yet.
5. `POST /api/jobs` — queues a render job. `lib/render-job.mjs` runs the
   pipeline orchestrator with `--storyboard` (approved board → no re-directing),
   tracking status in `web/data/jobs/`. `/studio/jobs` polls and shows the
   MP4 (`/api/jobs/<id>/video`) when done.

## Structure

- `app/api/brief/route.ts` — director endpoint (Node runtime)
- `app/api/storyboards/[id]/route.ts` — dev store: read, scene PATCH, delete
- `app/api/jobs/route.ts` — render job queue (POST) + listing (GET)
- `app/api/jobs/[id]/video/route.ts` — stream the rendered MP4
- `lib/director.ts` — director agent prompt + validation retry
- `lib/zen.ts` — server-only LLM client (same free line as `src/llm.mjs`)
- `lib/storyboard.ts` — storyboard contract, validation, scene summaries, "why look" annotations
- `lib/render-job.mjs` — background render worker (detached child of Next)
- `components/` — shell, button, badge, scene editor, why-look, render button, delete button

## Design

UI-PLAN tokens in `app/globals.css` (`@theme inline`): studio-black default,
paper-light under `prefers-color-scheme: light`. WCAG 2.2 AA tokens;
focus-visible ring never removed; reduced-motion respected.

## Next

- Scene library (approved scenes + brand kits reuse)
- Render cost metering (credits) on the jobs page
- Swap the JSON store for a database when the project outgrows local
