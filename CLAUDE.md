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
  `--stepper-h` 56, `--answer-h` 88, `--answer-h-upload` 296 (the upload
  zone, in every upload sheet), `--safe-top` / `--safe-bottom`.
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
- Soft 3D objects, used on the Income cards, the Documents cards
  (`documents-*.png`, mapped in `src/documents/artwork.ts`) and on Home's
  "Things you may need" (not in the hero). Decorative (empty alt),
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
  /motion previews both; FormCard, StepDots, LaptopPreview, Logo on /styleguide
  (both pages are development-only).
- Required documents: rules ONLY in `src/documents.config.ts` (TODO
  confirm with CPA). Everything (flow upload questions, income card form
  codes, Documents page, stepper, Home) reads them through
  `requiredItems(answers)` in `src/flow/requiredDocuments.ts`: documents
  (form expected) and self-reported income items (no form, where
  `reportableWithoutForm`). Skipped uploads store "later" or "none"; both
  still count as missing (every required document is needed; Continue on
  Documents stays locked until all are added). Counts via `summarizeItems`, words via `documentsLine` /
  `incomeItemsLine`. Never write a tax rule elsewhere; components never
  decide reportability. `npm run check:documents` tests the function.
  Identity documents (`IDENTITY_DOCUMENTS`): passport and I-94 required; a
  driver's license or state ID is `optional` (shown, never counted).
  `PREVIOUS_RETURN` (optional, only if filed before) shares its storage with
  the question's previous-return sheet.
- Documents page (`src/documents/`): friendly cards (`DocumentCard`: art,
  one soft primary-tint "Add"; "Added" pill + "Replace" once uploaded; no
  pill while not added; no "Not now"; drop a file on a card). Continue is
  the only cobalt element. ONE page for the tab and the flow.
  The flow opens it with history state { fromFlow: true } (navigate(path,
  state)); only then it shows the stepper and Continue. Items link as
  /documents#item-<id>. The stepper's Documents section uses
  `completed={{ 3: documentsDone(answers) }}`.
- Stepper: sections live in `src/flow/sections.ts` only. Screens name a
  section; `positionOf()` derives "x of n" from the screens that apply.
  Never hard-code a step number.
- v1 SCOPE (TODO confirm with CPA; `residency.config.ts`): a return is
  prepared only when the tax year is within the first 5 calendar years in
  student status (years with any presence count, full years abroad don't,
  the tax year counts; the sixth is out). `inScope()` / `isOutOfScope()` in
  `fromAnswers.ts`. Outside scope the flow stops at /not-supported: later
  screens are hidden, typed addresses redirect (App), the stepper ends at
  Time in the U.S., Home shows "not-supported". The stop screen explains
  "AtlasTax only prepares Form 1040-NR … you may need to file Form 1040"
  (forms named at the designer's request; "may", never "resident") and
  lists Other ways to file (`OTHER_WAYS_TO_FILE` in the config).
- Time in the U.S. (`src/residency/`): students only (F-1, J-1 student,
  M-1). Rules ONLY in `src/residency.config.ts` (TODO confirm with CPA);
  `fromAnswers.ts` decides which questions apply. Trips out of the U.S. are
  inverted into stays and counted as a date set. No jargon.
  `npm run check:residency`.
- Fake auth for testing only (`src/lib/auth.ts`): defaults to logged in,
  persists in localStorage, header badge (FakeAuthBadge) switches it, plus
  ?auth=in / ?auth=out and the /motion toggle. /welcome always shows the intro.
- Home (`src/home/`): the logged-in landing screen in every state; state
  from ONE function `returnStatus()` (Home and Documents use it). The
  questions start only from Home's button; "Save and exit" on every
  question. Earlier years in a sheet; privacy line from `PRIVACY_LINE`;
  Replay intro is on Profile. ?home=new|progress|documents|ready for testing.
- Answers are saved per tax year (`useFilingYear`, `setFilingYear` in
  flow/answers). Never hard-code a year: use the filing year.
- Copy: no promises (refunds, speed, savings, "free"), no invented numbers;
  unconfirmed claims are marked "TODO confirm" in code and FLOW.md.
  ONE approved exception: the result screen (`/result`, AFTER-DOCUMENTS-PLAN.md)
  may show a calculated federal estimate, always labelled "Estimate (prototype)",
  with no promise wording, hidden by the visible switch
  (`ESTIMATE_NUMBER_VISIBLE`), and NEVER on Home or in marketing. Every other
  screen still follows the rule above.

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
  real upload (`useUpload`, XHR progress events) to our server
  (`POST /api/files`, throttled in dev; see Server below). `Folder` (src/components): approved three-layer
  folder (fills only) inside the zone: the sheet slides in behind the front
  panel and the folder lifts on drop, the check draws on the front panel when
  done, and the sheet slides back out on error.
  Everywhere a file can be uploaded uses `UploadAnswer` (zone + real upload):
  the 8 income uploads and the previous-return sheet, ALL as slide-up
  sheets: an income upload (screen `sheet: true`) opens over the question
  before it, with Continue (unlocks only after a real upload) and its skip
  as a secondary button; back-to-back uploads replace the sheet. Its address
  (e.g. /income/opt-w2) shows that page with the sheet open; closing goes
  back. Sheets aren't stepper steps. "Add another file" stays.
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

## Test documents and ID numbers
- Fake documents only. PDFs live ONLY in `fixtures/synthetic/`; images only
  there or in the design folders (`src/assets/illustrations/`, `public/`,
  `references/`). SSN-like numbers only as 123-45-6789, 000-00-0000,
  111-11-1111 or 555-55-5555. `npm run check:files` enforces both (runs
  before every build). Extraction plan: EXTRACTION-PLAN.md.
- SSN, ITIN, EIN and passport numbers are shown ONLY through `mask()` /
  `maskSpoken()` (`src/lib/mask.ts`): screens, announcements, errors AND
  downloaded forms (last 4 digits only, everywhere, no "Show" for downloads);
  never logged. Downloads are therefore estimates, not fileable forms. Which fields each form has, which are masked and which need their
  own tick: ONLY `src/extraction.config.ts` (TODO confirm with CPA).
  `npm run check:extraction` tests both.

## Server (`server/`)
- `server/app.ts` is the API; `npm run dev` mounts it inside Vite (one
  command), `npm run server` runs it alone. Settings only in
  `server/config.ts`; the upload size limit is `MAX_UPLOAD_BYTES` in
  `src/config.ts` (shared with the browser).
- Files: checked by their first bytes (PDF or photo), stored privately in
  `.data/` (git-ignored), owned by a session cookie; only the owner can
  delete. Consent is recorded per session (on since extraction step 4).
- Never log file names, contents or values (route + error code only).
- Consent (`src/consent.config.ts`, `src/consent/`): the notice's words, version
  and the list of every published version (`CONSENT_NOTICES`, with a fingerprint
  of the exact words) live ONLY in `src/consent.config.ts` (placeholder wording,
  TODO confirm with legal). Changing the words needs a new version added to that
  list (`npm run check:consent`, part of the build). The SERVER sends the words;
  the sheet shows exactly them; agreeing echoes their version + fingerprint and
  the server records it only for the current notice (older → 409 + new words,
  "The notice has changed"). Never record agreement to words that weren't shown.
- Any `UploadAnswer` with an `upload` prop sends NO file bytes until the server
  has confirmed agreement (unknown → files wait; can't check → "We couldn't
  check your privacy settings." + Try again). Rules in `src/consent/logic.ts`.
  Hosts that open an upload provide `UploadHostContext` so "Not now" can close
  them; "Not now" closes the sheet even without one. A dropped file is sent
  once. Readable later on Profile.
- Dev switches: `?fail=1`, `?kbps=300`, `?dry=1` (measured, not stored;
  /motion uses it), development only: outside development the server REJECTS
  them (400). `/styleguide` and `/motion` are development-only pages, not in
  production builds (`scripts/check-prod-build.mjs` runs after every build).
  `npm run check:server` tests the safety rules.
- Reading (`server/extraction/`): providers behind one interface
  (`provider.ts`); the mock (`mockProvider.ts`, scenarios set on /motion,
  one per session) is the only one so far. `jobs.ts` reads a document as
  soon as a file is uploaded with `x-item-id` + `x-tax-year`; adding,
  replacing or removing a file re-reads it. Only documents in
  `ITEM_FORMS` are read. The browser gets statuses only, never values
  (live via `/api/extraction/events`; `useExtraction()` in
  `src/extraction/client.ts`). Extracted fields stay on the server.
- Every `UploadAnswer` that stores files passes `upload={{ key, itemId }}`:
  file ids are kept in `answers.fileIds[key]` (same order as the names) so
  Remove deletes the file on the server. No `upload` prop = measured only.
- Documents cards: "Reading" shares the corner spot with "Added" (space
  reserved); "Couldn't read" sits under the name with a reason, plus
  "Try again" when another try can help (else Replace).

## Tax year and the estimate (planned: AFTER-DOCUMENTS-PLAN.md)
- The app's tax year is **2025** (`TAX_YEAR` in `src/config.ts`): the first
  year the estimate is built and verified for (final IRS forms exist). Earlier
  years (2024, 2023) run the questions but show "We can't estimate this tax year
  yet". 2026 comes later (step R11, `draft` until the IRS posts the final form).
  Never type a year in screens, copy or tests of the app: read `TAX_YEAR` or the
  filing year.
- ALL tax rules (tables, deductions, limits, due dates, line map, "needs review"
  reasons) live ONLY in `src/tax/years/*` and `src/tax/` (built from step R1),
  each figure with its IRS source and marked "TODO confirm with CPA". The
  estimate is a pure function `estimateReturn(input, year)`; components never
  compute or decide tax. `npm run check:tax` (step R2) tests it.

## Tech stack
React + TypeScript + Tailwind CSS + Framer Motion, built with Vite.
Run locally with `npm run dev`, then open http://localhost:5173.
