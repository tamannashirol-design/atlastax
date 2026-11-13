// Motion tokens. One easing family: springs. Durations stay in 200–400ms.
// Low bounce keeps things calm. Under "Reduce motion", Framer Motion skips
// movement (scale/position) automatically via <MotionConfig reducedMotion="user">
// in main.tsx; color fades stay, because they're calm and still useful.
export const spring = {
  /** Things appearing or settling: check marks, progress. 400ms, gentle. */
  soft: { type: 'spring', duration: 0.4, bounce: 0.15 },
  /** Direct feedback to a touch: press and release. 250ms, no bounce. */
  quick: { type: 'spring', duration: 0.25, bounce: 0 },
} as const

/** How far things shrink while pressed. */
export const pressScale = { tile: 0.97, button: 0.98 }
