import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

// On/off switch (tool pages: style guide, motion). 44pt tap target; the knob
// glides with the quick spring.
export function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-11 shrink-0 items-center gap-2 rounded-full text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
    >
      {label}
      <span className={`flex h-8 w-12 rounded-full p-1 transition-colors ${on ? 'justify-end bg-text' : 'justify-start bg-border-strong'}`}>
        <motion.span layout transition={spring.quick} className="size-6 rounded-full bg-surface shadow-1" />
      </span>
    </button>
  )
}
