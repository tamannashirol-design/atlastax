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
