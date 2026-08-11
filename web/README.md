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
   values JSON, pacing meter. No credits spent yet.

## Structure

- `app/api/brief/route.ts` — director endpoint (Node runtime)
- `app/api/storyboards/[id]/route.ts` — dev store reader
- `lib/director.ts` — director agent prompt + validation retry
- `lib/zen.ts` — server-only LLM client (same free line as `src/llm.mjs`)
- `lib/storyboard.ts` — storyboard contract, validation, scene summaries
- `components/` — shell, button, form, placeholder primitives

## Design

UI-PLAN tokens in `app/globals.css` (`@theme inline`): studio-black default,
paper-light under `prefers-color-scheme: light`. WCAG 2.2 AA tokens;
focus-visible ring never removed; reduced-motion respected.

## Next

- Scene editing (values JSON → guarded forms), "why look" annotations
- Render endpoint → `src/orchestrator.mjs` (pipeline Phase 2)
- Supabase persistence replacing the JSON dev store
