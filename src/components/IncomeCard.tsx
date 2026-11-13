import { CheckIcon } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { Art } from '../data/income'
import { pressScale, spring } from '../lib/motion'

// Multi-select card (checkbox). 176pt tall.
//   top row:  [ 32 empty | illustration 64, centered | check badge 32 ]
//   label (Body semibold, up to 2 lines) + form code (Small, space reserved)
// States: default · hover (lifts with shadow, pointer devices only) · pressed
// (shrinks + sage fill) · selected (navy border + check badge; never color
// alone) · focus ring. "quiet" = the No earnings card: no illustration,
// page-colored background.

type Props = {
  label: string
  form?: string
  /** Illustration (1x/2x/3x). Omit for quiet cards. */
  art?: Art
  /** false = show the placeholder (illustrations not approved yet) */
  showArt?: boolean
  quiet?: boolean
  checked: boolean
  onToggle?: () => void
  /** Style guide only: show the pressed look without pressing. */
  forcePressed?: boolean
  /** Position in the grid, for the entrance stagger. */
  index?: number
}

export function IncomeCard({ label, form, art, showArt = true, quiet, checked, onToggle, forcePressed, index = 0 }: Props) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      data-pressed={forcePressed || undefined}
      // Enter with a short stagger. Reduced motion: fade only.
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: forcePressed ? pressScale.tile : 1 }}
      whileTap={{ scale: pressScale.tile }}
      transition={{ ...spring.soft, delay: index * 0.03, scale: spring.quick }}
      className={`flex min-h-44 w-full min-w-0 flex-col gap-2 rounded-md border p-4 text-center transition-[background-color,box-shadow,border-color] hover:shadow-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 data-pressed:bg-sage-100 ${
        quiet ? 'bg-background' : 'bg-surface'
      } ${checked ? 'border-text shadow-[inset_0_0_0_1px_var(--color-text)] hover:shadow-[inset_0_0_0_1px_var(--color-text),var(--shadow-2)]' : 'border-border-strong'}`}
    >
      <span className="grid h-16 grid-cols-[2rem_minmax(0,1fr)_2rem]">
        <span aria-hidden />
        <span className="flex items-center justify-center">
          {!quiet &&
            (showArt && art ? (
              // Decorative: empty alt. Fits the 64px box at its own proportions (never cropped).
              <img src={art.src} srcSet={art.srcSet} alt="" width={64} height={64} loading="lazy" decoding="async" className="size-16 object-contain" />
            ) : (
              <span aria-hidden className="size-12 rounded-full bg-sage-100" />
            ))}
        </span>
        <CheckBadge checked={checked} />
      </span>
      <span className="flex flex-1 flex-col justify-center">
        <span className="text-body font-semibold">{label}</span>
        <span className="min-h-5 text-small text-text-muted tabular-nums">{quiet ? 'None of the above' : form}</span>
      </span>
    </motion.button>
  )
}

function CheckBadge({ checked }: { checked: boolean }) {
  const reduce = useReducedMotion()
  // Only animate when the badge changes after the card first appears
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])
  return (
    <span aria-hidden className="flex size-8 items-start justify-end">
      {checked ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-text text-on-primary">
          <motion.span
            className="flex"
            // The check draws in left to right (~250ms). Reduced motion: fade.
            initial={mounted.current ? (reduce ? { opacity: 0 } : { clipPath: 'inset(0 100% 0 0)' }) : false}
            animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0% 0 0)' }}
            transition={spring.quick}
          >
            <CheckIcon size={24} weight="regular" />
          </motion.span>
        </span>
      ) : (
        <span className="size-8 rounded-full border border-border-strong" />
      )}
    </span>
  )
}
