import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

// The intro lays itself out from ITS OWN width, not the window's, so the same
// component is exact both full-screen and inside a scaled preview on /motion.
// Values mirror the app grid (index.css): 4 / 8 / 12 columns, margins
// 16 / 24 / 32, gutters 16 / 24, content capped at 1120.
//
//   below 768   phone composition (full-screen scenes)
//   768–1023    wide, stacked: steps as a row of tabs above the demo
//   1024 and up wide, split: steps in columns 1–5, demo in 6–12

export type Frame = { width: number; cols: number; margin: number; gutter: number; phone: boolean; split: boolean }

export function frameFor(width: number): Frame {
  return {
    width,
    cols: width < 600 ? 4 : width < 1024 ? 8 : 12,
    margin: width < 600 ? 16 : width < 1024 ? 24 : 32,
    gutter: width < 600 ? 16 : 24,
    phone: width < 768,
    split: width >= 1024,
  }
}

/** Measures the element and returns its frame (updates on resize). */
export function useFrame(ref: RefObject<HTMLElement | null>): Frame | null {
  const [frame, setFrame] = useState<Frame | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = (w: number) => setFrame((f) => (f && f.width === w ? f : frameFor(w)))
    update(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => update(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return frame
}

/** Grid tokens for everything inside the intro (gap-(--grid-gutter) etc. follow the frame). */
export const frameVars = (f: Frame) => ({ '--page-margin': `${f.margin}px`, '--grid-gutter': `${f.gutter}px` }) as CSSProperties

/** The question column for this frame: full width on 4 columns, 2–7 on 8, 4–9 on 12. */
export const questionColumn = (f: Frame): CSSProperties => ({ gridColumn: f.cols === 4 ? '1 / -1' : f.cols === 8 ? '2 / span 6' : '4 / span 6' })

export const gridStyle = (f: Frame): CSSProperties => ({ gridTemplateColumns: `repeat(${f.cols}, minmax(0, 1fr))` })
