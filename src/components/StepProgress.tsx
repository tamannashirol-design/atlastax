import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

// Thin progress bar + "1 of 7". The fill grows in with a soft spring
// (scale, so it's skipped under Reduce motion).
export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-label={`Step ${step} of ${total}`}
      className="flex min-w-0 flex-1 items-center gap-3"
    >
      <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-sage-100">
        <motion.div
          className="origin-left rounded-full bg-text"
          style={{ width: `${(step / total) * 100}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={spring.soft}
        />
      </div>
      <span className="shrink-0 text-small text-text-muted tabular-nums">
        {step} of {total}
      </span>
    </div>
  )
}
