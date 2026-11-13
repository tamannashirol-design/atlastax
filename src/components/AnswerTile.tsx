import { CheckIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import type { KeyboardEventHandler, Ref } from 'react'
import { pressScale, spring } from '../lib/motion'

type Props = {
  code: string
  description?: string
  /** Hide the code from screen readers when the description says the same thing. */
  codeHidden?: boolean
  selected: boolean
  onSelect?: () => void
  /** Style guide only: show the pressed look without pressing. */
  forcePressed?: boolean
  tabIndex?: number
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>
  ref?: Ref<HTMLButtonElement>
}

// A single-choice answer tile (behaves like a radio button).
// Unselected: white tile, sage border. Pressed: sage fill, shrinks slightly.
// Selected: navy border (drawn 2px wide without shifting layout) + check mark.
// Navy, not primary blue: the screen's one primary element is the Continue button.
export function AnswerTile({ code, description, codeHidden, selected, onSelect, forcePressed, tabIndex, onKeyDown, ref }: Props) {
  return (
    <motion.button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      data-pressed={forcePressed || undefined}
      whileTap={{ scale: pressScale.tile }}
      animate={{ scale: forcePressed ? pressScale.tile : 1 }}
      transition={spring.quick}
      className={`flex min-w-0 flex-col gap-1 rounded-md border bg-surface p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 data-pressed:bg-sage-100 ${
        selected ? 'border-text shadow-[inset_0_0_0_1px_var(--color-text)]' : 'border-border-strong'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-title" aria-hidden={codeHidden || undefined}>
          {code}
        </span>
        <AnimatePresence initial={false}>
          {selected && (
            <motion.span
              key="check"
              className="flex shrink-0"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={spring.soft}
            >
              <CheckIcon size={24} weight="regular" aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {description && <span className="text-small text-text-muted">{description}</span>}
    </motion.button>
  )
}
