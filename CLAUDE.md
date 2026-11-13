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
  bar, bottom sheets, system font stack.
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

- Question screens: a centered column, max width about 560px on iPad and
  laptop. Never stretch rows edge to edge.

## Navigation
- Phone: bottom tab bar.
- iPad: left sidebar.
- Laptop: left sidebar or top nav (decide in the style direction step).

## Brand
- Brand color: brand new. Discard the old teal and cream entirely.

## Icons
- Phosphor, one weight (regular), 24px grid.
- No SF Symbols (not licensed for web).

## Fonts
- System stack (-apple-system, SF Pro on Apple devices) with Inter as fallback.

## Tech stack
React + TypeScript + Tailwind CSS + Framer Motion, built with Vite.
Run locally with `npm run dev`, then open http://localhost:5173.
