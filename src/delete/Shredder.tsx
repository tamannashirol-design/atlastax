import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

// Our own shredder drawing: a navy slab with a slot on top and one round light. Inline SVG, colours only from tokens
// (index.css --shred-*), no text inside. Decoration: the status line next to it says everything. `finished` fades the
// light to the success colour (two stacked circles, one fading in, so no colour is animated).
export function Shredder({ finished, reduce }: { finished: boolean; reduce: boolean }) {
  return (
    <svg data-shredder viewBox="0 0 240 112" width="240" height="112" aria-hidden className="block h-28 w-60">
      <rect x="0" y="0" width="240" height="112" rx="20" fill="var(--shred-body)" />
      {/* the top face, a little lighter, with the slot cut into it */}
      <rect x="0" y="0" width="240" height="30" rx="20" fill="var(--shred-top)" />
      <rect x="40" y="10" width="160" height="10" rx="5" fill="var(--shred-slot)" />
      {/* the front: two quiet lines, and the light */}
      <rect x="28" y="64" width="72" height="6" rx="3" fill="var(--shred-top)" />
      <rect x="28" y="78" width="48" height="6" rx="3" fill="var(--shred-top)" />
      <circle cx="204" cy="74" r="9" fill="var(--color-border-decorative)" />
      <motion.circle cx="204" cy="74" r="9" fill="var(--color-success)" initial={false} animate={{ opacity: finished ? 1 : 0 }} transition={reduce ? spring.fade : spring.quick} />
    </svg>
  )
}
