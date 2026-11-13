import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { pressScale, spring } from '../lib/motion'

type Props = {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  /** Style guide only: show the pressed look without pressing. */
  forcePressed?: boolean
}

// The screen's one primary action. Full width, 56pt tall.
// Disabled: sage fill with a muted label that stays readable (4.77:1).
export function PrimaryButton({ children, disabled, onClick, forcePressed }: Props) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-pressed={forcePressed || undefined}
      whileTap={disabled ? undefined : { scale: pressScale.button }}
      animate={{ scale: forcePressed ? pressScale.button : 1 }}
      transition={spring.quick}
      className="flex h-14 w-full items-center justify-center rounded-sm bg-primary px-6 text-body font-semibold text-on-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-primary-pressed disabled:bg-sage-100 disabled:text-text-muted data-pressed:bg-primary-pressed"
    >
      {children}
    </motion.button>
  )
}
