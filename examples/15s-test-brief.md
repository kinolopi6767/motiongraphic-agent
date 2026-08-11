# 15-Second Test Script

A ready-to-paste brief that exercises three motion verbs in one 15s video:
cold-open kinetic title → stat count-up → closing pipeline beat.

## Copy-paste brief

> A 15-second launch teaser for Aurora, a music app: 1.2 million tracks in
> lossless quality, and offline playlists that adapt to your commute. Bold,
> punchy, quick cuts.

## Expected storyboard shape

| Time | Verb | Why |
|------|------|-----|
| ~5s | `kinetic-title` | Hook — "Aurora" reveal with accent line |
| ~5s | `count-up` | Proof — 1.2M tracks counting up |
| ~5s | `pipeline-flow` | Close — streaming → offline flow beats |

The director may swap `pipeline-flow` for a `chart-race` depending on its read;
either is fine for a smoke test.

## How to test

1. `npm run dev` (repo root) → open the printed URL (`http://localhost:3001` if
   your port 3000 is busy).
2. `/studio` → paste the brief above.
3. Pick a **style** (try `Neon Nights` or `Energetic` for obvious visual
   difference), leave the model on `deepseek-v4-flash-free`, ratio `16:9`.
4. **Plan the storyboard — free** → review the board (edits, A/B/C hooks free).
5. **Render** — costs 1 credit (1 cr per 15s); the dialog shows the seed family.
6. Jobs page: watch live stages, then play the MP4, scrub contact-sheet frames,
   check the motion-guard chips (all scenes should PASS).

## What "passing" looks like

- 3 scenes, ~15s total, verbs from the table above.
- Motion guard: every scene shows a ✓ (score ≥ 2.0 — rich templates score 9+).
- SFX bed present (audio track in the player).
- Value-bomb thumbnail generated (poster on the player).
- Token usage line on the storyboard page (director call ~5–6k tokens on
  deepseek-v4-flash-free).

## Variations

- **Zero-gap**: change one number on a scene card → "Re-render scene — 1 cr" →
  only that segment re-renders (rest bit-identical).
- **Ratios**: pick 16:9 + 1:1 + 9:16 in the render dialog (3× cost).
- **Voice**: enable Deepgram in Settings → AI model → Voice (needs a key) and
  re-render; captions appear with the player.
