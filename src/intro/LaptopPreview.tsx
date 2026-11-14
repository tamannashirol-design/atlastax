import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FlowStepper } from '../components/FlowStepper'
import { TAX_YEAR } from '../config'
import type { FlowPosition } from '../flow/sections'
import { PreviewContext } from './previewContext'

// The real laptop layout (top bar, stepper rail in columns 1–3, question in
// columns 4–9) drawn at full size on a 1024 × 560 canvas, then scaled to fit
// its card. A clean card with a subtle border and shadow, not a device frame.
// Decorative: the intro hides it from screen readers and says the same in text.
//
//   canvas 1024 wide: margins 32, gutter 24, 12 columns (58.67 each)
//   top bar 56 · 48 · question (Display) · 8 · helper · 40 · answer area

const CANVAS_W = 1024
const CANVAS_H = 560

/** question: omit when the demo draws its own question (scene 1 changes question mid-way). */
type Props = { position: FlowPosition; question?: string; helper?: string; children: ReactNode }

export function LaptopPreview({ position: start, question, helper, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(start)
  const ctx = useMemo(() => ({ setPosition }), [])
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const update = (w: number) => setScale(w / CANVAS_W)
    update(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => update(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border-decorative bg-background shadow-2">
      {/* Outer box sets the scaled height; the canvas inside keeps true sizes and is scaled with a transform */}
      {/* grid + minmax(0,1fr): the 1024-wide canvas doesn't count toward this box's width */}
      <div ref={box} className="grid w-full grid-cols-[minmax(0,1fr)] overflow-hidden" style={{ height: CANVAS_H * scale }}>
        <div
          className="flex flex-col"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: '0 0', visibility: scale ? 'visible' : 'hidden' }}
        >
          <div className="flex h-(--top-bar-h) shrink-0 items-center justify-center shadow-[inset_0_-1px_0_var(--color-border-decorative)]">
            <span className="text-body font-semibold">{TAX_YEAR} tax return</span>
          </div>
          <div className="grid gap-x-6 px-8 pt-12" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
            <div style={{ gridColumn: '1 / span 3' }}>
              <FlowStepper presentation="rail" position={position} />
            </div>
            <div className="flex flex-col" style={{ gridColumn: '4 / span 6' }}>
              {question && <span className="font-display text-display">{question}</span>}
              {question && helper && <span className="mt-2 text-small text-text-muted">{helper}</span>}
              <div className={`flex flex-col ${question ? 'mt-10' : ''}`}>
                <PreviewContext.Provider value={ctx}>{children}</PreviewContext.Provider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
