import { motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useState } from 'react'
import { spring } from '../lib/motion'

// The AtlasTax wordmark: Fraunces, Title size. Text, so it scales with the
// user's font size and needs no image.
//
// settle: the logged-in Home only. On the first load of each browser session
// it settles in (rise 4 + fade, the soft spring after a 200ms beat: about
// 600ms in all). Never under reduced motion, and nowhere else.

const SESSION_KEY = 'atlastax:logo-settled'

function settledThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return true // storage blocked: don't animate on every page view
  }
}

export function Logo({ settle = false }: { settle?: boolean }) {
  const reduce = useReducedMotionConfig() ?? false
  // Decided once, on the first render (state survives StrictMode's re-run of effects)
  const [play] = useState(() => settle && !reduce && !settledThisSession())
  useEffect(() => {
    if (!settle) return
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* storage blocked */
    }
  }, [settle])
  return (
    <motion.span
      className="inline-flex font-display text-title"
      initial={play ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.soft, delay: 0.2 }}
    >
      AtlasTax
    </motion.span>
  )
}
