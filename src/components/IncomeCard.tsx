import { CheckIcon } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { Art } from '../data/income'
import { pressScale, spring } from '../lib/motion'

// Multi-select card (checkbox). A vertical stack of fixed zones, all on the
// 4pt grid, so every card in a row is the same height and labels line up:
//
//   top band     44  = 12 padding + 32 selection circle (top-right corner)
//   gap           8  ← the icon box always clears the circle by at least 8
//   icon zone    80 phone / 96 from 600px; square icon box, centered, contain
//   gap          12
//   label zone   68  = two label lines (48) + form-code line (20), top-aligned
//   bottom pad   16
//   ─────────────────
//   card height 228 phone / 244 from 600px
//
// States: default · hover (lifts with shadow, pointer devices only) · pressed
// (shrinks + sage fill) · selected (navy border + check badge; never color
// alone) · focus ring. "No earnings" is not a card: see IncomeRow below.

type Props = {
  label: string
  form?: string
  /** Illustration. Omit to show the placeholder. */
  art?: Art
  /** false = show the placeholder instead of the illustration */
  showArt?: boolean
  checked: boolean
  onToggle?: () => void
  /** Style guide only: show the pressed look without pressing. */
  forcePressed?: boolean
  /** Position in the grid, for the entrance stagger. */
  index?: number
}

export function IncomeCard({ label, form, art, showArt = true, checked, onToggle, forcePressed, index = 0 }: Props) {
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
      className={`flex h-57 w-full min-w-0 flex-col rounded-md border px-4 pt-3 pb-4 text-center transition-[background-color,box-shadow,border-color] hover:shadow-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 data-pressed:bg-sage-100 tablet:h-61 bg-surface ${checked ? 'border-text shadow-[inset_0_0_0_1px_var(--color-text)] hover:shadow-[inset_0_0_0_1px_var(--color-text),var(--shadow-2)]' : 'border-border-strong'}`}
    >
      {/* Top band: selection circle in the top-right corner */}
      <span className="flex h-8 shrink-0 justify-end">
        <CheckBadge checked={checked} />
      </span>

      {/* Icon zone */}
      <span data-zone="icon" className="mt-2 flex h-20 shrink-0 items-center justify-center tablet:h-24">
        {showArt && art ? <Illustration art={art} /> : <span aria-hidden className="size-12 rounded-full bg-sage-100" />}
      </span>

      {/* Label zone: same height and top edge on every card */}
      <span data-zone="label" className="mt-3 flex h-17 shrink-0 flex-col">
        <span className="line-clamp-2 text-body font-semibold">{label}</span>
        <span className="text-small text-text-muted tabular-nums">{form}</span>
      </span>
    </motion.button>
  )
}

// Slim full-width checkbox row for "No earnings", below the income cards.
// Same states as the cards, page-colored background so it reads as the quiet
// "none of these" option. Label + hint on one line (they wrap at large text
// sizes; the row grows), selection circle on the right, same as the cards.
//
//   16 padding · label "No earnings" (Body) 8 hint (Small, muted) · circle 32 · 16 padding
//   min height 56 (circle centered; the row grows only at large text sizes)

type RowProps = {
  label: string
  hint: string
  checked: boolean
  onToggle?: () => void
  forcePressed?: boolean
  index?: number
}

export function IncomeRow({ label, hint, checked, onToggle, forcePressed, index = 0 }: RowProps) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      data-pressed={forcePressed || undefined}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: forcePressed ? pressScale.button : 1 }}
      whileTap={{ scale: pressScale.button }}
      transition={{ ...spring.soft, delay: index * 0.03, scale: spring.quick }}
      className={`flex min-h-14 w-full min-w-0 items-center gap-4 rounded-md border bg-background px-4 py-1 text-left transition-[background-color,box-shadow,border-color] hover:shadow-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 data-pressed:bg-sage-100 ${
        checked ? 'border-text shadow-[inset_0_0_0_1px_var(--color-text)] hover:shadow-[inset_0_0_0_1px_var(--color-text),var(--shadow-2)]' : 'border-border-strong'
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className="text-body font-semibold">{label}</span>
        <span className="text-small text-text-muted">{hint}</span>
      </span>
      <CheckBadge checked={checked} />
    </motion.button>
  )
}

/** The illustration itself: a square box (80 phone / 96 from 600px), centered, contain. Decorative. */
export function Illustration({ art }: { art: Art }) {
  return (
    <img
      src={art.src}
      srcSet={art.srcSet}
      sizes={art.sizes}
      alt=""
      width={96}
      height={96}
      loading="lazy"
      decoding="async"
      className="size-20 object-contain tablet:size-24"
    />
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
    <span aria-hidden data-zone="circle" className="flex size-8">
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
