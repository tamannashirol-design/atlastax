# Upload motion: what the reference does

**Status: approved and built** (`src/components/UploadZone.tsx`, demo at /motion).
Decisions: `pop` and `fade` tokens added; name `quick` kept; approach hint on
iPad/laptop only (faint border); progress = line around the edge, clockwise
from top center, with a live percentage; no auto-reset; no rising document;
red only for errors.
Update: the approved `Folder` now sits in the zone. On drop the sheet slides
down behind the front panel (soft) and the folder lifts 4px; while uploading,
the line draws around the zone edge; on done, the check pops on the front panel
(pop, draws in 250ms) and the folder settles; on error the sheet slides back
out. The earlier document card is replaced by the folder plus status text.

Source: `references/motion/upload-documents.mov` (13.8s, 1444×948, recorded at
~30fps, so timings are ±33ms). Measured from 785 captured frames: motion energy
per frame, card width per frame, and check-badge size per frame. Only timing,
order and feel are taken from it; none of its visuals (blue folder, cursor,
paper sheet, colors, type) will be copied.

The video shows two runs:
- **Rejected file** (0–4.0s): an unsupported file is dragged over the zone twice.
- **Accepted file** (4.8–11.8s): a photo is dragged in, dropped, uploads, done.

## Accepted file: phase by phase

| # | Phase | Starts | Motion lasts | What moves, in order | Feel | Overlap | What the user sees |
|---|---|---|---|---|---|---|---|
| 0 | Idle | 0.0s | none | Nothing | Still | — | Dashed zone, "drop files to upload / or click to browse", "or try sample files" below |
| 1 | File approaches (not over the zone yet) | 4.88s | ~240ms | Label text cross-fades only | Quick fade, no movement | — | Text changes to "drop 1 file / bring them over the card" |
| 2 | File over the zone ("zone pulses") | 5.34s | ~410ms of motion, settled by ~600ms | Together: border dashed → solid, card gains a soft lift, a document slides **up** out of the zone | Soft spring: starts gently, peaks at ~240ms, long calm settle, **no visible overshoot**. Card width doesn't change: the "pulse" is the border + lift, one beat | Text cross-fade ("let go to upload") runs during the first ~200ms | Zone feels "ready"; document is visibly waiting to go in |
| 3 | Drop | 7.22s | sharp start, main change in ~200ms, settles by ~600ms | Document slides back **down** into the zone; border fades away; label cross-fades | Snappy start (no ease-in), then a soft settle | Text swap and document drop start on the same frame | "uploading 1 file" |
| 4 | Uploading ("ring fills") | 7.95s | tracks progress (~600ms in this demo) | A thin line draws clockwise around the card's edge, starting at top center; status text updates; the document slowly rises again with progress | Smooth and continuous, no jumps or bounce | Ring and text update together | "uploading 1 file / 21%, 48 KB of 230 KB" → 48% → 77% |
| 5 | Finishing | 8.6s | ~450ms hold | Ring complete; nothing moves | Still | — | "uploading 1 file / finishing" |
| 6 | Done ("check pops") | 9.11s | ~320ms | A round check badge appears and pops: 88% → **114%** at ~140ms → 100% by ~320ms. The check mark is drawn inside it. Border tints toward green | Small spring with a clear overshoot (~14%) | Text cross-fade ("1 file uploaded / 230 KB") overlaps the pop | Success, calm hold |
| 7 | Reset | 11.62s | ~200ms | Cross-fade back to idle | Quick fade | — | Idle again (demo only; see notes) |

## Rejected file

| Phase | Starts | Motion lasts | What moves | Feel | What the user sees |
|---|---|---|---|---|---|
| Unsupported file over the zone | 0.53s | ~480ms | Border turns solid red; document slides up; label turns red | Ease-out: fast start (peak at ~110ms), long settle, no overshoot | "not supported / images, pdfs, sheets, text and zip" |
| File leaves | 2.01s | ~510ms | Border back to dashed; document slides down; label back | Same ease-out, mirrored | Idle text |

## Mapped to our motion tokens

| Reference moment | Measured | Our token | Fits? |
|---|---|---|---|
| Text cross-fades | ~200–240ms | `quick` spring, 250ms, no bounce (opacity) | ✓ |
| Drag over: border, lift, 1.01 scale | ~400ms, settled ~600ms, no overshoot | `soft` spring, 400ms, bounce 0.15 | ✓ |
| Document card settles in (4px rise) | ~400ms | `soft` | ✓ |
| Drop response | ~200ms | `quick` | ✓ |
| Ring/bar following real progress | smooth, never bounces | `quick` (bounce 0), so it can't overshoot backwards | ✓ |
| Check pop | ~300ms, ~14% overshoot | **none: both our springs are too calm** | ✗ → new token |
| Reduced-motion fade | — | **150ms: not defined yet** | ✗ → new token |

### New tokens I'd propose (not added yet)

1. **`pop`**: `{ type: 'spring', duration: 0.25, bounce: 0.3 }`, for the check
   badge only. That gives about 6–8% overshoot. It's calmer than the reference's
   ~14%, in line with "no overshoot beyond what's clearly needed". If you want
   to match the reference exactly, use bounce 0.45 instead.
2. **`fade`**: 150ms opacity, for the reduced-motion replacement of every
   movement (your 150ms duration, which we don't have yet).
3. Naming: your brief says "snappy", while ours is called `quick`. I'd keep
   `quick` and treat them as the same thing, unless you'd rather rename it.

## Notes for the build (Step 2)

- **Finishing (phase 5)** becomes "waiting for the server" after all bytes are
  sent: driven by the real upload, never a timer.
- **Reset (phase 7)** is demo-only. In AtlasTax, Done stays until the person
  moves on or removes the file.
- **Approach hint (phase 1)** only works when a file is dragged anywhere over
  the page. I can include it ("Drop it on the box") or skip it. It isn't in your
  state list.
- **The reference's document rising during upload (phase 4)** is a literal
  object, so I'd drop it; the ring and the text carry the progress.
- **Live region:** "Uploading W-2" when phase 4 starts, "Uploaded" at phase 6,
  and the error message on failure.
