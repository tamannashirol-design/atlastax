import { CheckIcon } from '@phosphor-icons/react'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { sections } from '../flow/sections'
import { spring } from '../lib/motion'

// The return's sections as a labelled row (Home's hero). Each section: a
// thin bar (navy fill for done, half for the current one) and its name.
// Done = check icon + name; current = name in bold; not started = muted.
// Never color alone: the list also says "done" / "current" to screen readers.
// 3 per row (two rows) up to 1023px; 1024px+: all 6 in one row (the hero is only 5 columns wide on iPad).
// Motion: the fills grow once on load (soft spring); reduced motion: they fade in.

export function ProgressRow({ done, current }: { done: number; current: number | null }) {
  const reduce = useReducedMotionConfig() ?? false
  return (
    <ol aria-label="Your progress" className="grid grid-cols-3 gap-x-2 gap-y-4 desktop:grid-cols-6">
      {sections.map((s, i) => {
        const state = i < done ? 'done' : i === current ? 'current' : 'upcoming'
        const fill = state === 'done' ? 1 : state === 'current' ? 0.5 : 0
        return (
          <li key={s.id} aria-current={state === 'current' ? 'step' : undefined} className="flex min-w-0 flex-col gap-2">
            <span aria-hidden className="flex h-1 overflow-hidden rounded-full bg-border-decorative">
              <motion.span
                className="w-full origin-left rounded-full bg-text"
                initial={reduce ? { opacity: 0, scaleX: fill } : { scaleX: 0 }}
                animate={{ opacity: 1, scaleX: fill }}
                transition={{ ...(reduce ? spring.fade : spring.soft), delay: reduce ? 0 : 0.2 + i * 0.04 }}
              />
            </span>
            <span className={`flex items-start gap-1 text-small ${state === 'upcoming' ? 'text-text-muted' : state === 'current' ? 'font-semibold' : ''}`}>
              {state === 'done' && <CheckIcon size={16} weight="regular" aria-hidden className="mt-0.5 shrink-0" />}
              <span>
                {s.label}
                <span className="sr-only">{state === 'done' ? ', done' : state === 'current' ? ', current' : ', not started'}</span>
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
