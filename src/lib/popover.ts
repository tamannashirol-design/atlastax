// Keeps a dropdown list attached to its field. The list lives in the browser's
// top layer (the `popover` attribute), so it floats above the page without any
// absolute positioning in our layout. It opens below the field, or above when
// there isn't room. It follows the field on scroll and resize.
import { useEffect, useLayoutEffect, type RefObject } from 'react'

const GAP = 8
const MAX = 320

export function useAnchoredPopover(open: boolean, anchor: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>, onOutside: () => void) {
  useLayoutEffect(() => {
    const el = pop.current
    if (!el) return
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    el.showPopover()
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      if (!a) return
      const below = window.innerHeight - a.bottom - GAP * 2
      const above = a.top - GAP * 2
      const up = below < 200 && above > below
      const max = Math.min(MAX, up ? above : below)
      Object.assign(el.style, {
        margin: '0',
        inset: 'auto',
        left: `${a.left}px`,
        width: `${a.width}px`,
        maxHeight: `${max}px`,
        top: up ? `${a.top - GAP - Math.min(el.scrollHeight, max)}px` : `${a.bottom + GAP}px`,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  })

  // Close when tapping anywhere outside the field and the list
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!anchor.current?.contains(t) && !pop.current?.contains(t)) onOutside()
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open, anchor, pop, onOutside])
}
