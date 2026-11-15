import { CheckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { loopVars, spring } from '../lib/motion'
import type { ReadingStage } from './logic'

// The Reading page's one status pill (MOTION-reading.md; reference
// references/motion/documents-extract.mov, rebuilt from our tokens).
//   [dots] Reading your documents  →  [dots] Extracting your details  →  [✓] Done
// - Working: the dot grid scans (loop.scan) and a soft sage band sweeps across the
//   pill BEHIND the label (loop.sweep). The label stays on top at full contrast.
//   Both loops pause when the tab is hidden or the pill is off-screen.
// - Label change (reference order): old label + icon fade out (fade) → the pill
//   resizes (quick) → new label slides in 4px from the right (quick) → icon last
//   (100ms later).
// - Done: the success fill fades in over the white pill, the pill narrows and
//   settles on `soft` (the reference's small settle), check + "Done" fade in on top
//   in on-primary. `onSettled` fires when the fill has finished.
// - Reduced motion: no loops, no slide, no resize animation; every change is a
//   `fade`. Same three labels.
// Decorative layers stack in one grid cell (no absolute positioning). The label
// itself is NOT announced from here: the page's live region says each stage once.

/** Loops pause when the tab is hidden or the element is scrolled off-screen. */
function useLoopsPaused<T extends Element>() {
  const ref = useRef<T>(null)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const [offscreen, setOffscreen] = useState(false)
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    const el = ref.current
    const io = el && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting)) : null
    if (el && io) io.observe(el)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      io?.disconnect()
    }
  }, [])
  return [ref, hidden || offscreen] as const
}

/** 3×3 navy dots in a 24px box; while `animate`, one row at a time lights up (loop.scan: 3 rows + a rest step). */
function ReadingDots({ animate }: { animate: boolean }) {
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
      <span className={`flex flex-col gap-1 ${animate ? 'loop-scan' : ''}`}>
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="flex gap-1" style={{ ['--i' as string]: i, ...(animate ? {} : { opacity: i === 0 ? 1 : 0.28 }) }}>
            {Array.from({ length: 3 }, (_, j) => (
              <span key={j} className="size-1 rounded-full bg-text" />
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}

export function ReadingPill({ stage, label, reduce, onSettled }: { stage: ReadingStage; label: string; reduce: boolean; onSettled: () => void }) {
  const [ref, paused] = useLoopsPaused<HTMLDivElement>()
  const working = stage === 'reading' || stage === 'extracting'
  const done = stage === 'done'
  const loops = working && !reduce
  return (
    <motion.div
      ref={ref}
      layout={!reduce}
      transition={done ? spring.soft : spring.quick}
      data-loops={paused ? 'paused' : 'running'}
      data-stage={stage}
      // Corner radius in style so Framer keeps it round while the width animates
      style={{ ...loopVars, borderRadius: 28 }}
      className="grid min-h-14 self-start overflow-hidden border border-border-decorative bg-surface shadow-1"
    >
      {/* The soft band, behind the label (decorative; never on top of text) */}
      {loops && (
        <div aria-hidden className="pointer-events-none flex overflow-hidden [grid-area:1/1]">
          <div className="loop-sweep h-full w-1/2 shrink-0 bg-linear-to-r from-transparent via-sage-100 to-transparent" />
        </div>
      )}
      {/* Done: the success fill fades in over the white pill */}
      <motion.div
        aria-hidden
        className="pointer-events-none bg-success [grid-area:1/1]"
        initial={false}
        animate={{ opacity: done ? 1 : 0 }}
        transition={reduce ? spring.fade : spring.soft}
        onAnimationComplete={() => done && onSettled()}
      />
      {/* Label + icon, on top of every layer */}
      <div className="flex items-center px-6 [grid-area:1/1]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={stage + label}
            layout={reduce ? false : 'position'}
            className={`flex items-center gap-3 text-body font-semibold ${done ? 'text-on-primary' : stage === 'failed' ? 'text-error' : 'text-text'}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0, transition: reduce ? spring.fade : spring.quick }}
            exit={{ opacity: 0, transition: spring.fade }}
          >
            <motion.span className="flex" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduce ? spring.fade : { ...spring.quick, delay: 0.1 } }}>
              {working ? (
                <ReadingDots animate={loops} />
              ) : done ? (
                <CheckIcon size={24} weight="regular" aria-hidden />
              ) : (
                <WarningCircleIcon size={24} weight="regular" aria-hidden />
              )}
            </motion.span>
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
