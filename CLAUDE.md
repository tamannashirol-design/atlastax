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
  `--stepper-h` 56, `--answer-h` 88, `--safe-top` / `--safe-bottom`.
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
- Soft 3D objects, used only on the Income cards. 64px box, image shown
  5% larger inside it (≈67px), decorative
  (empty alt), lazy loaded, 1x/2x/3x WebP via `npm run illustrations`.
- Designer's files in `src/assets/illustrations/`, used exactly as provided:
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

## Motion
- Relaxing, not busy: soft springs, 200 to 400ms, one easing family
  (springs).
- Respect prefers-reduced-motion with calm static fallbacks.

## Filing flow
- Sections and steps live in `src/flow/sections.ts` (see FLOW.md).
- Country of citizenship sits in Tax details (designer confirming it's in
  the flow).
- Stepper shows "x of n" only for sections with more than one step.
- Compact stepper: the current section's bar segment fills halfway through
  the current step (e.g. step 1 of 3 = 1/6 filled), so it reads "in progress".
- Rail at ≥1024px (laptop, iPad landscape); compact below.

## Tax year
- One constant: `TAX_YEAR` in `src/config.ts` (currently 2025, to confirm:
  2025 or 2026). Every place a year appears (stepper rail, Home, previous
  years, forms, deadlines) reads it from there. Never hard-code a year.

## Tech stack
React + TypeScript + Tailwind CSS + Framer Motion, built with Vite.
Run locally with `npm run dev`, then open http://localhost:5173.
