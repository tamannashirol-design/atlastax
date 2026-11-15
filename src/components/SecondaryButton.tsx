import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { pressScale, spring } from '../lib/motion'

// The quieter companion to PrimaryButton: white with a sage border, navy label.
// Same height and press motion. Never blue, so the screen keeps one primary.
// tone "destructive": red label (error token) for actions that delete, e.g.
// "Remove file" in a confirmation sheet.
// tone "quiet": no outline, cobalt label (designer's choice for Home's
// "Filing for an earlier year?" under the cobalt button).
type Props = { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: 'default' | 'destructive' | 'quiet' }

export function SecondaryButton({ children, onClick, disabled, tone = 'default' }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: pressScale.button }}
      transition={spring.quick}
      className={`flex h-14 w-full items-center justify-center rounded-sm bg-surface px-6 text-body font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 disabled:text-text-muted ${tone === 'quiet' ? 'text-primary' : 'border border-border-strong disabled:border-border-decorative'} ${tone === 'destructive' ? 'text-error' : ''}`}
    >
      {children}
    </motion.button>
  )
}
