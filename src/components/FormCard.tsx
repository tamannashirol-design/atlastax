import { CheckIcon, DownloadSimpleIcon } from '@phosphor-icons/react'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { pressScale, spring } from '../lib/motion'

// A finished tax form, ready to download. Used in the intro (scene 3) and
// meant for the Review / Ready screens later.
//
//   ┌───────────────────────────────────────┐  surface, border-strong, radius lg, shadow 2
//   │ Form 1040‑NR                ✓ Ready   │  Title (Fraunces) · success Small
//   │ U.S. Nonresident Alien Income Tax…    │  Small, muted
//   │ ▬▬▬▬▬▬▬▬▬▬▬▬                          │  preview lines (sage, decorative)
//   │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                    │
//   │ ▬▬▬▬▬▬▬                               │
//   │ Example data           [↓ Download PDF] │  Small muted · secondary button 44
//   └───────────────────────────────────────┘
// Padding 24, gaps 16. Settles in with the soft spring (rise 16 + fade);
// reduced motion: fade only. Never blue: the screen's primary is elsewhere.

type Props = {
  form: string
  title: string
  /** Small line bottom-left, e.g. "Example data" */
  note?: string
  onDownload?: () => void
  /** -1 for demo copies (the intro) */
  tabIndex?: number
}

export function FormCard({ form, title, note, onDownload, tabIndex }: Props) {
  const reduce = useReducedMotionConfig() ?? false
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? spring.fade : spring.soft}
      className="flex w-full flex-col gap-4 rounded-lg border border-border-strong bg-surface p-6 shadow-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="font-display text-title">{form}</span>
          <span className="text-small text-text-muted">{title}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-small font-semibold text-success">
          <CheckIcon size={24} weight="regular" aria-hidden />
          Ready
        </span>
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        <span className="h-2 w-1/2 rounded-full bg-sage-100" />
        <span className="h-2 w-5/6 rounded-full bg-sage-100" />
        <span className="h-2 w-1/3 rounded-full bg-sage-100" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-small text-text-muted">{note}</span>
        <motion.button
          type="button"
          onClick={onDownload}
          tabIndex={tabIndex}
          whileTap={{ scale: pressScale.button }}
          transition={spring.quick}
          className="flex h-11 shrink-0 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
        >
          <DownloadSimpleIcon size={24} weight="regular" aria-hidden />
          Download PDF
        </motion.button>
      </div>
    </motion.div>
  )
}
