# Delete motion: the shredder

**Status: approved and built** (`src/delete/`: `DeletedPage` = the stage and the confirmation, `ShredderStage`, `Shredder`; `npm run audit:delete`).
Decisions: strips fade away; the sheet no longer shows the error (the stage does); the count is a status line under the machine.
Built differences: the browser forgets the answers the moment the server confirms (not when the animation ends), so the two never disagree; the cards are listed identity first, so the passport goes first. Not tested by a script: hiding the tab mid-way (the sequence waits for the tab to be visible; checked by reading the code).

Source: `references/motion/references:motion:shredderdelete.mov` (the file's own clock says 8.1s, 1124×550, ~57fps; the player
shows a different length, so read my times as "seconds into the file"). No video tool is installed here, so I pulled still frames
every 0.2s and looked at them. Timings below are therefore **±100ms**, and I only trust order and feel, not exact milliseconds.
Only timing, order and feel are taken from it. None of its artwork (the dark Shredline machine, orange slot glow, green digits,
polaroid, sticky note, paper, stamps, cursor, type) is copied.

## What the reference does

The person drags a document over the shredder and lets go. Three documents in the video.

| # | Phase | Starts | Lasts | What moves | Feel |
|---|---|---|---|---|---|
| 0 | Idle | 0.0s | — | Documents lie scattered at small angles; the machine is a dark slab with a green light and a counter at 00 | Still |
| 1 | Hover ("let go to shred it") | ~1.4s | ~300ms | The slot glows; the light turns amber; the caption changes. The document being held rises a little above the slot | Quick fade, small lift |
| 2 | Drop and feed | ~2.1s | ~700ms | The document straightens, centres on the slot and slides **down into it** (it disappears behind the front lip, never changes size) | Snappy start, steady slide, no bounce |
| 3 | Strips fall | ~2.5s | ~1.2s | Narrow strips of the document's own colours drop out of the underside, tumble and spin, and land in a loose pile at the bottom; the pile stays | Light, a bit random, gravity (fast at the end) |
| 4 | Count | ~3.0s | ~200ms | The counter ticks 00 → 01; the light goes back to green | Instant swap |
| 5 | Next document | ~4.2s | — | Repeats from phase 1 (in the reference the person starts each one). Documents that are waiting don't move | — |

## Our version: no dragging

The person confirms deletion; the cards go in by themselves, one after another.

### Where it plays

A new full page, `/deleted` (the page we already have), becomes the **shredding stage**. The confirmation sheet's red button no
longer runs the request itself: it closes the sheet and opens the stage, and **the stage sends the delete request the moment it
opens**. So the animation plays while the request runs. (This replaces the "cards gather and dissolve" step I built before.)

The stage, top to bottom (centred, max width 448px on phone, wider from 600px):

1. A heading: "Deleting your documents" (Fraunces, display size), focus lands here.
2. **The queue**: our own document cards, with their real names ("W-2", "Passport", "Most recent I-94", ...), in a wrapping row
   (4 across on a phone, up to 8 in all, 2 rows). Each is a small version of the Documents card: sage-bordered surface, the
   soft 3D art at 40px, the name in Small type. Only documents the person has added are shown.
3. **The shredder**: our own SVG drawing, tokens only. A navy slab (`--color-text`), a thin slot, a small round light
   (sage → `success` when finished), and a tray under it. No text inside the SVG.
4. **The tray**: where the strips land (a shallow sage-100 shape under the machine).
5. A quiet status line under the machine: "Shredding 2 of 5" (real HTML, tabular numbers).
6. For "Delete tax forms only": a second row labelled "Staying" with the ID cards (passport, I-94, driver's license or ID,
   previous return). They sit still, a little quieter (no shadow), and never go near the machine.

### What happens, step by step

Each tax-form card does steps A to C. Cards start **450ms apart** (the "short stagger"), in the order they are listed.

| Step | Trigger | What moves | Token / duration | Starts |
|---|---|---|---|---|
| 0 Stage opens | arriving on `/deleted` | Heading, queue and machine fade up together (opacity, 12px rise). The request is sent now | `soft`, 400ms | 0ms |
| A Lift | the card's turn comes | The card leaves its place and travels in a straight line to just above the slot: x/y to the slot, rotation to 0, scale 1 → 0.9 | `soft`, 400ms | card n starts at 400 + n × 450ms |
| B Feed | A is 60% done | The card slides straight **down** behind the machine's front lip (the lip is in front, so the card disappears; nothing is clipped or resized). Opacity stays 1 until it is hidden | `soft`, 400ms | A + 240ms |
| C Strips | B starts | 10 narrow strips (cobalt, sage, navy, sage-100: our palette) appear under the slot, fall 120 to 160px with a little sideways drift and spin, fade out over their last 30% | one keyframed path per strip, 900ms (a rise-and-fall or tumble can't be drawn with a spring, same exception as the confetti) | B + 120ms |
| D Count | B finishes | The status line changes to "Shredding n of N" (cross-fade); the light flickers once to `success` and back (opacity, 150ms) | `quick`, 250ms | B + 400ms |
| E Finish | all cards fed **and** the server has said yes | Strips finish falling; the light settles on `success`; the machine fades out; the heading becomes "Everything's been deleted" (or "Tax forms deleted") and the cards that stayed are named in the line under it; the button "Back to Home" appears | `soft`, 400ms; machine `quick` fade | after the last strip, or when the server confirms, whichever is **later** |

With 4 cards the whole thing is about 400 + 3 × 450 + 400 + 240 + 400 ≈ **2.4s**, plus the finish. More cards add 450ms each.
(The reference needed about 1.8s for one document; ours is a little slower per card because each one has to travel in by itself.)

### Tied to the server (this is the important part)

| What happens | What the person sees |
|---|---|
| Request is sent at step 0 and still running when the last card is fed | The machine waits with the light steady and the status line saying "Deleting". Nothing says "deleted" |
| The server answers 200 | Step E runs. Only now does the heading change, and only now does the browser forget the answers |
| The server answers with an error, or can't be reached, **at any moment** (even after some cards are in) | Feeding stops. Every card returns to its place together (the reverse of A: `soft`, 400ms, fade back in); strips fade out; the heading becomes "We couldn't delete them"; an error says "Nothing has been deleted. Please try again."; **Try again** runs the whole thing again; a quiet "Back to Home" |
| Server confirms while cards are still going in | The cards keep going; step E waits for the last one (the server is never ahead of what's on screen) |

### Delete tax forms only

Only the tax-form cards (W-2, 1042-S, 1099 and the brokerage and investment forms: `TAX_FORM_ITEM_IDS`) are in the queue. The
ID cards are in the "Staying" row, still, the whole time. Delete everything: every card is in the queue and there is no
"Staying" row. No cards at all (nothing was uploaded): no machine; the heading and status wait for the server, then the
confirmation fades in.

### Reduced motion

No machine, no strips, no travelling. The cards (all that are going) fade out together over 150ms (`fade`). Status text is
the same; the confirmation fades in when the server confirms. On failure the cards fade back in.

### Pause when the tab is hidden

Framer's animations already stop when the browser stops drawing frames. On top of that, the sequence only **starts the next
card** while the page is visible, and carries on from the same card when you come back. The request itself keeps going
(it's a real deletion), so the confirmation can be waiting when you return.

### Accessibility

- Focus: on arrival to the heading ("Deleting your documents"); on success to the new heading; on failure to the error
  message. After "Back to Home", the usual Home focus.
- Live region (always in the page, polite): "Deleting", then "Deleted" (or "Tax forms deleted"), or the error text (alert).
  The cards, machine and strips are `aria-hidden`; the real card names are listed once as plain text for screen readers
  ("Deleting: W-2, Passport...").
- Buttons (Try again, Back to Home) are at least 44px tall. There are no buttons while it runs, so nothing to mis-tap.
- Contrast: card names in `text` on `surface`; status in `text-muted` on `background` (already registered pairs); the machine
  is decoration, so its colours carry no information (the status line says everything).
- Layout: phone one column (queue 4 across, cards 80×96); from 600px cards 96×112 and the machine is larger; from 1024px the
  stage sits in the content column (max 448px, centred) beside nothing else. No horizontal scroll.

### What changes in what I built

- `DeleteSheet`: the red button now just opens the stage (no request, no error state in the sheet).
- `/deleted` becomes the stage and the confirmation, and it owns the request, the error and Try again. It must know the
  cards, so the sheet passes them in the history state (names and ids, not files).
- If you reload the stage, it asks the server again (deleting twice is harmless: the second answer is "0 deleted").
- New: `ShredderStage` (the drawing and the sequence), card list from `requiredItems()`.
- The checks: server checks stay as they are. New audit: the cards go in one after another (positions at 3 sample times),
  the confirmation is not on screen before the server confirms (a delayed answer), failure returns the cards, tax-forms-only
  leaves the ID cards, reduced motion has no strips.

### Not copied

Their machine, colours, paper, polaroid, sticky note, stamps, cursor, hover glow, counter style, caption wording, the pile that
stays and grows. Ours: a navy slab with a round light, strips in our palette that fade away, and plain status text.

### Things I'd like you to decide

1. **Strips in the tray**: fade away (my suggestion: calm, nothing left on screen) or stay as a pile like the reference?
2. **Sheet error**: OK that the sheet no longer shows the error (it moves to the stage after the cards return)?
3. **Counter**: "Shredding 2 of 5" under the machine, or a small number on the machine itself?
