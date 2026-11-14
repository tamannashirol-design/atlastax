import { motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { spring } from '../lib/motion'
import { IntroContent } from './IntroContent'

// First-run intro, full screen: a modal <dialog> over Home (traps focus, the
// page behind is inert). Two compositions from the same scenes, copy and
// components, chosen by width (IntroContent):
//   below 768  phone: full-screen scenes (IntroPhone)
//   768 and up wide: steps + live laptop preview (IntroWide)
// Escape and Skip leave (handled inside, so a scaled preview behaves the same).
// On open, focus goes to the composition's root (not a button): screen readers
// hear "Welcome to AtlasTax" and the current step, keys work at once, and no
// ring flashes on a button nobody pressed.

export type IntroExit = 'skip' | 'start' | 'account'

export function Intro({ onClose }: { onClose: (how: IntroExit) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const reduce = useReducedMotionConfig() ?? false

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    d?.focus()
    // Then the composition's root (it handles the keys), once it has measured and rendered
    const raf = requestAnimationFrame(() => d?.querySelector<HTMLElement>('[data-intro-root]')?.focus())
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <motion.dialog
      ref={ref}
      aria-label="Welcome to AtlasTax"
      aria-describedby="intro-description"
      tabIndex={-1}
      onCancel={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        // Escape while the dialog itself has focus (inside, the compositions handle it)
        if (e.key === 'Escape' && e.target === e.currentTarget) {
          e.preventDefault()
          onClose('skip')
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? spring.fade : spring.quick}
      className="m-0 size-full max-h-none max-w-none bg-background p-0 text-text outline-none backdrop:bg-transparent"
    >
      <IntroContent onClose={onClose} />
    </motion.dialog>
  )
}
