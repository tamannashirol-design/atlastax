// Motion tokens. One easing family: springs. Durations 150 / 250 / 400ms.
// Under "Reduce motion", movement is replaced by `fade` (see MotionConfig in
// main.tsx and useReducedMotionConfig in components).
export const spring = {
  /** Things appearing or settling: drag-over, cards settling in. 400ms, gentle (bounce 0.15). */
  soft: { type: 'spring', duration: 0.4, bounce: 0.15 },
  /** Direct feedback: press/release, text cross-fades, progress following. 250ms, no bounce. ("snappy" in briefs) */
  quick: { type: 'spring', duration: 0.25, bounce: 0 },
  /** Small celebratory pop: the upload check only. 250ms, ~6% overshoot (measured 6.1–6.3%). */
  pop: { type: 'spring', duration: 0.25, bounce: 0.34 },
  /** Reduced-motion replacement for any movement: a 150ms fade. */
  fade: { type: 'spring', duration: 0.15, bounce: 0 },
} as const

/** How far things shrink while pressed. */
export const pressScale = { tile: 0.97, button: 0.98 }

/**
 * Loops: things that repeat until a REAL event stops them (approved for the Reading
 * page; EXTRACTION-PLAN.md, MOTION-reading.md). Not springs, so they live here as
 * their own group. Rules: they run only while something is actually being read,
 * pause when the tab is hidden or the element is off-screen, and never run under
 * reduced motion (a still state with the same text instead). CSS in index.css
 * (.loop-scan, .loop-sweep) reads these through --loop-* variables set from here.
 */
export const loop = {
  /** "Being read": a dark row steps down a dot grid, 1.6s per pass in 4 steps (one every 0.4s), opacity only. */
  scan: { duration: 1.6, steps: 4 },
  /** A soft light band across a DECORATIVE surface (never over text): 1.4s moving (ease-in-out) + 0.6s rest = 2.0s, transform only. */
  sweep: { duration: 2.0, move: 1.4 },
} as const

/** The CSS variables the loop classes read (put on the element that owns the loops). */
export const loopVars = {
  '--loop-scan': `${loop.scan.duration}s`,
  '--loop-scan-step': `${loop.scan.duration / loop.scan.steps}s`,
  '--loop-sweep': `${loop.sweep.duration}s`,
} as Record<string, string>
