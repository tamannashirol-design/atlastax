import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { pressScale, spring } from '../lib/motion'

// The quieter companion to PrimaryButton: white with a sage border, navy label.
// Same height and press motion. Never blue, so the screen keeps one primary.
export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: pressScale.button }}
      transition={spring.quick}
      className="flex h-14 w-full items-center justify-center rounded-sm border border-border-strong bg-surface px-6 text-body font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 disabled:border-border-decorative disabled:text-text-muted"
    >
      {children}
    </motion.button>
  )
}
