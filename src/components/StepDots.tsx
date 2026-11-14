import { motion, useReducedMotionConfig } from 'framer-motion'
import { spring } from '../lib/motion'

// Quiet step indicator (the intro): one short bar per step, the current one
// navy. Colors don't animate: each bar is a sage track with a navy layer on
// top that fades in. Hidden from screen readers; the intro announces
// "Step 2 of 3" in its live region instead.
//
//   bar 24 × 4, gap 8

export function StepDots({ current, total }: { current: number; total: number }) {
  const reduce = useReducedMotionConfig() ?? false
  return (
    <div aria-hidden className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-stack className="grid h-1 w-6">
          <span className="rounded-full bg-border-decorative [grid-area:1/1]" />
          <motion.span
            className="rounded-full bg-text [grid-area:1/1]"
            initial={false}
            animate={{ opacity: i === current ? 1 : 0 }}
            transition={reduce ? spring.fade : spring.quick}
          />
        </span>
      ))}
    </div>
  )
}
