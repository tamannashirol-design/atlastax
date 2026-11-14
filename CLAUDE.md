# AtlasTax redesign

## Working with me
I'm a designer, not a developer. Explain every step in plain language, work in
small steps, and tell me how to see the result after each one. Ask before
anything destructive.

## Project
AtlasTax, a tax-filing app for international students. Web app,
phone + laptop. I'm redesigning the UI from scratch.

/references has the OLD screens. Use them ONLY to understand the flow, copy,
and logic. Do not copy their visual style: it had no grid, no hierarchy, and
elements floating over each other. The flow is documented in FLOW.md.

## Design brief
- Premium but friendly, like Venmo and Airbnb: serious subject, warm and
  playful details.
- Follow Apple HIG: 44pt tap targets, safe areas, large titles, bottom tab
  bar, bottom sheets. (Fonts: see Type below, which replaces the system
  font stack.)
- Everything sits on a 4pt grid. Nothing floats. Flex/grid layout only, no
  absolute positioning for layout.
- One primary action per screen. Clear type hierarchy.
- One icon family, one stroke weight, 24px grid. Every icon needs a reason.
- WCAG AA contrast, verified by a script.
- Motion is purposeful, spring-based, and respects reduced motion.

## Platform
- Web app (React), iOS-styled. Not native. Must work on phone, iPad, and laptop.

## Breakpoints and grid
| Device | Width | Columns | Margins | Max content width |
|---|---|---|---|---|
| Phone | up to 599px | 4 | 16pt | full width |
| iPad | 600 to 1023px | 8 | 24pt | full width |
| Laptop | 1024px+ | 12 | — | 1120px |

- Question screens use `QuestionLayout` (see below).

## App shell and layout tokens
- Shell = 3 rows filling the screen: top bar (every breakpoint), content
  (only part that scrolls), tab bar (phone only, below 768px). Content never
  sits under a bar.
- Tokens in index.css: `--top-bar-h` 56, `--tab-bar-h` 56 (0 at 768px+),
  `--stepper-h` 56, `--answer-h` 88, `--answer-h-upload` 296 (every upload
  question and the previous-return sheet), `--safe-top` / `--safe-bottom`.
- Question screens (`QuestionLayout`): one block =
  header (question reserves 3 lines on phone, 2 at 600px+; helper 8 below
  it, reserving 2 lines on phone, 1 at 600px+), 40 gap, fixed-height answer
  area, 32 gap, Continue, 8 gap, help link (2 lines reserved). Unused header space falls ABOVE the
  question, so the helper stays 40 above the tiles and tiles/Continue never
  move between question screens. Keep questions within 3 lines on a 390px phone. The rail starts level with the question.
  No pinning. Block sits slightly above center
  (spacers 2:3). Below 1024: compact stepper directly under the top bar.
  1024+: rail (cols 1–3) top-aligned with the question (cols 4–9).

## Navigation
- Top bar on every breakpoint (back, title).
- Phone (below 768px): bottom tab bar, also during the filing flow.
- iPad: left sidebar.
- Laptop: left sidebar or top nav (decide in the style direction step).
- During the filing flow, the stepper (`FlowStepper`) replaces navigation:
  vertical rail in grid columns 1–3 at ≥1024px (laptop, iPad landscape);
  compact header stepper + bottom sheet below 1024px (phone, iPad portrait).
  Progress is navy; Continue stays the only blue element.


## Icons and illustrations (two separate categories)
**UI icons**
- Phosphor only, one weight (regular), 24px. Every icon needs a reason
  (listed on /styleguide). No SF Symbols (not licensed for web).

**Illustrations**
- Soft 3D objects, used only on the Income cards. Decorative (empty alt),
  lazy loaded. Icon box 80px on phone, 96px from 600px, centered, contain.
- `npm run illustrations`: trims each file's transparent border, fits the art
  in a 384px square with equal ~8% padding (illustrations/normalized/), then
  exports 96/192/288px WebP. Designer's originals stay untouched; otherwise
  never redraw, recolor, crop, or filter. Sources in CREDITS.md.

## Type (max 2 families, 4 sizes)
- Display/headlines: **Fraunces** (free stand-in for Arizona Flare). One
  swappable token: `--font-display`.
- UI/body: **Inter** (stand-in for Dia). One swappable token: `--font-ui`.
- 4 sizes only, no others anywhere:
  | Token | Size | Line height |
  |---|---|---|
  | Display | 34 | 40 |
  | Title | 22 | 28 |
  | Body | 17 | 24 |
  | Small | 13 | 20 |
- Max 2 weights per family.
- Tabular numerals for all numbers and money: add the `tabular-nums` class
  to any element showing numbers. (Not applied globally, because in Inter it
  also widens hyphens.)
- Hierarchy comes from size, weight, and color only.
- Text scales with the user's font size settings (sizes in rem).

## Color (light mode only)
Cobalt + sage. Trustworthy blues and deep greens. Off-white background,
never pure white. Roles only; no decorative colors.

| Role | Hex | Used for |
|---|---|---|
| background | #F4F7F2 | Page background |
| surface | #FFFFFF | Cards, tiles, sheets |
| text | #0E1B2C | Main text |
| text-muted | #5B6B58 | Helper text, captions |
| primary | #1F4FD8 | The one primary element per screen |
| primary-pressed | #183DAA | Primary while pressed |
| primary-tint | #E8EEFC | Light primary wash |
| on-primary | #FFFFFF | Text/icons on primary |
| success | #166534 | Success states |
| error | #B42318 | Error states |
| border-decorative | #C3D0BE | Dividers only (not for controls) |
| border-strong | #788874 | Control borders (needs 3:1) |
| sage-100 | #E6EDE3 | Quiet fills, pressed and disabled states |

Rules:
- One primary-colored element per screen. Everything else is text, sage,
  or surface.
- Disabled controls keep a readable label (at least 3:1).
- `npm run contrast` tests every text/background and UI pair we use and
  fails if text is under 4.5:1 or UI components under 3:1. It runs before
  every build. Register new pairs in `src/tokens/pairs.ts`.

## Intro and Home
- Intro (`src/intro/`): the logged-out entry page ("/" while logged out,
  `src/landing/`); logged-in people get Home and can replay it from Help
  (dialog). Scenes are a data array (`content.ts`): add one there, layouts
  follow. Each scene moves on 1s (`SCENE_GAP_MS`) after its moment ends.
  Two compositions chosen by the intro's own width (`frame.ts`): phone below
  768 (`IntroPhone`), wide 768+ (`IntroWide`: tablist + `LaptopPreview`;
  stacked tabs below 1024, split 5/7 columns from 1024). Modes: "page"
  (logo, who-it's-for, Get started, Log in, footer) and "replay" (Skip).
  /motion previews both; FormCard, StepDots, LaptopPreview, Logo on /styleguide.
- Fake auth for testing only (`src/lib/auth.ts`): /motion toggle or
  ?auth=in / ?auth=out. No real authentication yet.
- Home (`src/home/`): one primary (Start / Continue where you left off),
  previous years from `PREVIOUS_TAX_YEARS`, privacy line from `PRIVACY_LINE`
  (empty until confirmed), Help → Replay intro. The logo settles in once per
  session (Logo `settle`), only here, never under reduced motion.
- Answers are saved per tax year (`useFilingYear`, `setFilingYear` in
  flow/answers). Never hard-code a year: use the filing year.
- Copy: no promises (refunds, speed, savings, "free"), no invented numbers;
  unconfirmed claims are marked "TODO confirm" in code and FLOW.md.

## Upload animation (rules)
- Any reference is for timing, sequence and behavior only; rebuild all visuals
  from this design system (no copied colors, fonts, shapes or icon style).
- Text is real HTML in our type tokens (Inter UI, Fraunces headlines only;
  34/22/17/13). No text inside images or SVG.
- Folder, drop zone, tray and file icons are inline SVG colored only with
  tokens: body primary-tint, outline border-strong, details navy, progress
  navy, success token, error token. No hex values anywhere.
- Radii, stroke widths (`--stroke-1/2`) and shadows from tokens; 4pt grid.
- Cobalt stays reserved for the primary action button.
- Built: `UploadZone` (src/components) with choreography from
  MOTION-upload.md; play every state on /motion. Progress always comes from a
  real upload (`useUpload`, XHR progress events); in dev, `/api/upload` is a
  throttled test endpoint. `Folder` (src/components): approved three-layer
  folder (fills only) inside the zone: the sheet slides in behind the front
  panel and the folder lifts on drop, the check draws on the front panel when
  done, and the sheet slides back out on error.
  Everywhere a file can be uploaded uses `UploadAnswer` (zone + real upload):
  the 8 income upload questions (answerArea "upload", "Add another file")
  and the previous-return sheet. Continue unlocks only after a real upload.
  Uploaded files are listed below the zone (zone stays 296; each file row
  adds 56 + the 16 gap), each with a text "Remove" button. Remove asks first
  in a sheet naming the exact file ("Remove file" in error red / "Keep
  file"), announces "Removed <file>. N files left." and moves focus to the
  next Remove button or back to the zone. Removing the last file empties the
  zone and locks Continue again.
  Focus is moved on purpose, never left on the body: upload starts → the
  zone's status message; done → the new file row (tabindex -1), live region
  "<file> uploaded"; failed → the error message (then "Try again", or
  "Choose another file" for a wrong file type); removed → "Choose a file"
  (or "Add another file" if files remain), "<file> removed". Visible focus
  ring on all of them. `npm run audit:focus` (dev server running) checks
  this keyboard-only on all 8 upload screens and the sheet.
  Register every new pair in `src/tokens/pairs.ts`.

## Motion
- Relaxing, not busy: springs only, durations 150 / 250 / 400ms. Tokens in
  `src/lib/motion.ts`, used everywhere (never hard-code a spring):
  | Token | Spring | Use |
  |---|---|---|
  | `quick` | 250ms, no bounce | Press/release, text cross-fades, progress following. Called "snappy" in briefs: same thing, keep the name `quick` |
  | `soft` | 400ms, bounce 0.15 | Things settling: drag-over, cards entering, stepper marker |
  | `pop` | 250ms, bounce 0.34 (≈6% overshoot) | Upload check only |
  | `fade` | 150ms, no bounce | Reduced-motion replacement for any movement |
- Animate transform and opacity only (colors switch by fading layers).
  Animations must be interruptible.
- prefers-reduced-motion: movement becomes a `fade`; status text stays.
  Components read it with `useReducedMotionConfig()`.

## Tech stack
React + TypeScript + Tailwind CSS + Framer Motion, built with Vite.
Run locally with `npm run dev`, then open http://localhost:5173.
