# Scripts — paste a narration script, we segment it like a voice-over

The engine does NOT want "make a 10-second video about X". Give it a real
narration script — the kind you'd hand a voice-over artist — and it:

1. **Segments** the script into beats the way a VO reads it (one thought per
   breath, 5–14 words).
2. **Times the video from the words**: each scene's duration ≈ that beat's
   spoken length at ~150 words/minute.
3. **Plans a scene per segment**, values drawn only from the segment's facts.

## Sample script (~32s at 150 wpm)

> Every Sunday, Maria saves forty percent on her groceries with Loop. No
> coupons, no hunting — the app just finds the deals. Since 2021, Loop has
> grown from two hundred daily orders to over three point two million. And our
> customers rate us four point eight out of five. The secret? We buy directly
> from farms, cut out the middleman, and pass the savings to you. Fresh
> produce, delivered to your door, every single week. That's Loop — smarter
> shopping, simpler life.

Paste it into /studio, leave duration on **auto — from the script**, and Plan.
The storyboard's "Script beats" strip shows the segmentation; each scene is
sized to its segment's spoken length.

## How to write scripts for the engine

- Write for the **ear, not the eye**: short sentences, spoken numbers
  ("three point two million", not "3.2M").
- ~15 words per 5-second scene; 30 words per 10-second scene.
- Structure on purpose: hook → context → claim → proof → payoff → closer.
  The engine maps scenes onto those kinds and chooses motion recipes by the
  beat's emotion (slam for the hook, confetti for the record, readout for the
  rating, travel for the journey).
- Every number you want on screen must appear in the script.
