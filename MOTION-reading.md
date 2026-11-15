# Reading motion: what the reference does

**Status: APPROVED (Nov 15, 2026), including the two loop tokens (`loop.scan`, `loop.sweep`; they pause when the tab is hidden or the hero is off-screen, and reduced motion shows a static state with the same text). The Reading page is not built yet (build step 5).**

Source: `references/motion/documents-extract.mov` (13.2s, 1444×948, ~55fps).
Measured from 661 frames, one every 0.02s and cropped to the pill, so timings
are ±20ms. For each frame I measured the pill's width, its fill color, how
light the label is in three zones (left, middle, right), and which row of the
dot grid is darkest. Only timing, order and feel are taken from the video.
None of its visuals are copied: not the thick white rim, the grey capsule,
the bright green "Done", or the dot icon as drawn.

## What the video shows

One status pill in the middle of an empty page: a 5×5 grid of dots on the
left and a label on the right. The label runs through a **fixed, timed**
script, Thinking → Reading docs → Analysing → Debugging → Done, and then the
video loops. The grid and a light sweep across the label keep moving while
each label is showing.

The script is on a timer (each label shows for about 2.7s). That's the one
thing we must **not** copy: our labels change only when the backend reports an
event (see EXTRACTION-PLAN.md, "Reading page").

## Phase by phase

| # | Phase | Starts | Motion lasts | What moves, in order | Feel | What the user sees |
|---|---|---|---|---|---|---|
| 0 | Working ("Thinking") | 0.0s | loops | Dots flicker at random; a light band sweeps across the label | Calm, continuous, no jumps | "Thinking" |
| 1 | Label change (→ "Reading docs") | 2.22s | ~300ms in total | ① old label and icon fade out (~80ms, 2.22–2.30) ② pill widens to fit (~160ms, 2.26–2.42) ③ new label fades in, sliding slightly from the right, sharpening left to right (~200ms, 2.30–2.50) ④ new icon fades in last (~120ms, 2.42–2.54) | Quick, no bounce; out is faster than in; icon trails the text by ~120ms | "Reading docs" |
| 2 | Working ("Reading docs") | 2.54s | loops | **Scan:** the dark row of dots steps down the grid, one row every ~0.4–0.6s, a full pass in ~1.45s, then starts again at the top. **Sweep:** a light band crosses the label left to right in ~1.4s, then rests ~0.6s (cycle ~2.0s) | Scan moves in steps, not smoothly. Sweep eases in and out: it reaches the left word, holds briefly, moves on | "Reading docs" |
| 3 | Label change (→ "Analysing") | 5.12s | ~300ms | Same as phase 1; the pill narrows (~180ms, 5.12–5.30) | Same | "Analysing" |
| 4 | Working ("Analysing") | ~5.4s | loops | Different dot pattern (single dots light in turn), same sweep | Same | "Analysing" |
| 5 | Label change (→ "Debugging") | 7.92s | ~300ms | Same as phase 1; the pill widens (~120ms) | Same | "Debugging" |
| 6 | Working ("Debugging") | ~8.1s | loops | Dense dot pattern, same sweep | Same | "Debugging" |
| 7 | Done | 10.72s | ~450ms, settled by ~11.2s | ① green fill fades in over the grey (~140ms, 10.72–10.86) ② pill narrows (10.74–10.92) and settles with a tiny overshoot (re-widens ~1% at 11.12–11.16) ③ check and "Done" fade in and sharpen (10.78–10.90) | The only springy moment: a small settle, no visible bounce | "✓ Done" on a filled green pill |
| 8 | Done sheen | 11.10s | ~250ms | A diagonal light streak crosses the pill once | Decorative flourish | "✓ Done" |
| 9 | Reset | 11.74s | instant | Back to "Thinking" | — | Demo loop only |

## Mapped to our motion tokens

| Reference moment | Measured | Our token | Fits? |
|---|---|---|---|
| Old label fades out | ~80ms | `fade` (150ms) | ✓ (a little calmer) |
| New label fades in, small slide | ~200ms | `quick` (250ms, no bounce) | ✓ |
| Pill / row resizes to the new label | ~120–180ms | `quick` | ✓ |
| Icon trails the label | ~120ms later | `quick` with a 100ms delay | ✓ |
| Done: fill appears, size settles with a tiny overshoot | ~450ms total | `soft` (400ms, bounce 0.15) | ✓ |
| Done: the check | ~120ms | `pop` | ✗ CLAUDE.md reserves `pop` for the upload check. Reuse it here, or keep the reading check on `soft`? (Q in the plan) |
| **Scan** through the dots | step every ~0.45s, cycle ~1.45s | **none**: our tokens are one-off springs, not loops | ✗ → new token |
| **Sweep** across the label | ~1.4s across + ~0.6s rest = ~2.0s | **none** | ✗ → new token |
| Reduced motion | — | `fade`; loops stop | ✓ |

### New tokens I'd propose (not added yet)

Loops aren't springs, so they need their own small group next to `spring` in
`src/lib/motion.ts`, for things that repeat until a real event stops them:

1. **`loop.scan`**: 1.6s per pass, moving in 4 steps (`steps(4)`), repeating.
   The step every 0.4s matches the reference's stepped scan. Used for the
   "this document is being read" indicator only.
2. **`loop.sweep`**: 2.0s cycle (1.4s moving with ease-in-out, 0.6s rest),
   repeating. Used for a light band moving across a **decorative** surface only.

Both run only while a job is actually in progress, stop the moment an event
arrives, and never run under reduced motion.

## What we keep, what we drop

- **Keep:** the order (old text out → container resizes → new text in → icon
  last); fast out, slower in; calm continuous loops while waiting; one small
  settle at the end; nothing else bouncing.
- **Drop: the timed script.** Our labels change only on job events.
- **Drop: the sweep across the text.** In the reference the sweep lightens the
  label to about #949494 on #EEEEEE, roughly 2.8:1, which fails our 4.5:1
  rule. Our label stays at full contrast; the sweep moves across the
  decorative illustration only.
- **Drop: blur.** The reference blurs labels in and out. Our rules allow
  transform and opacity only, so it becomes opacity plus a 4px slide.
- **Drop: the Done sheen (phase 8).** It's decoration and doesn't say anything new.
- **Drop: the reset (phase 9).** Demo only. "Ready to review" stays.
- **Visuals rebuilt from our tokens** (detail in the plan): white surface,
  radius from tokens, `--shadow-1`, a hairline `border-decorative`, navy dots
  at token opacities, Inter 17/13 labels, the `success` token for the check
  with no saturated fill, and no thick rim.

## Live region (for the build)

Polite: "Reading your W-2" when a document starts, "Checking your W-2", "W-2
ready to review", "Couldn't read your 1042-S". Never on every loop tick.
