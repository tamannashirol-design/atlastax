import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { sections, stepCount, type FlowPosition } from '../flow/sections'
import { BottomSheet } from './BottomSheet'
import { spring } from '../lib/motion'

// One stepper, two presentations:
//   rail    → vertical list (laptop, iPad landscape). Replaces the left nav during the flow.
//   compact → section name, "2 of 3" and a 5-segment bar (phone, iPad portrait).
//             Tapping it opens a bottom sheet with the same vertical list.
// The parent decides which presentation shows at which width.
//
// Colors: navy (text) for progress; Continue stays the screen's only blue element.
// Motion: marker glides to the next section, check wipes in (~250ms), connector
// fills. With Reduce motion on, each of these becomes a fade.

type Props = {
  presentation: 'rail' | 'compact'
  position: FlowPosition
  /** Called with a section index when a completed section is chosen. */
  onNavigate?: (section: number) => void
  /**
   * Sections whose "done" doesn't follow position alone, e.g. Documents:
   * done only when requiredItems() says nothing is outstanding. Applies to
   * the current section and those before it (later sections stay upcoming).
   */
  completed?: Partial<Record<number, boolean>>
}

type State = 'done' | 'current' | 'upcoming'

/** One rule for every presentation: position, unless `completed` says otherwise. */
function sectionState(i: number, position: FlowPosition, completed?: Props['completed']): State {
  const override = i <= position.section ? completed?.[i] : undefined
  if (override === true) return 'done'
  if (override === false) return i === position.section ? 'current' : 'upcoming'
  return i < position.section ? 'done' : i === position.section ? 'current' : 'upcoming'
}

export function FlowStepper({ presentation, position, onNavigate, completed }: Props) {
  return presentation === 'rail' ? (
    <StepList position={position} onNavigate={onNavigate} completed={completed} group="rail" />
  ) : (
    <CompactStepper position={position} onNavigate={onNavigate} completed={completed} />
  )
}

// ---------- shared vertical list ----------

const srState: Record<State, string> = {
  done: ', completed',
  current: ', current section',
  upcoming: ', not started',
}

function StepList({ position, onNavigate, completed, group }: Omit<Props, 'presentation'> & { group: string }) {
  // Only animate check marks that appear after the first render, not on page load.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])

  return (
    <LayoutGroup id={group}>
      <nav aria-label="Filing progress">
        <ol className="flex flex-col">
          {sections.map((s, i) => {
            const state = sectionState(i, position, completed)
            const count = state === 'current' ? stepCount(position) : null
            const content = (
              <>
                <Marker state={state} animateIn={mounted.current} />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={`text-body ${state === 'current' ? 'font-semibold' : ''} ${state === 'upcoming' ? 'text-text-muted' : 'text-text'}`}
                  >
                    {s.label}
                    <span className="sr-only">
                      {srState[state]}
                      {count ? ', step ' : ''}
                    </span>
                  </span>
                  {count && <span className="text-small text-text-muted tabular-nums">{count}</span>}
                </span>
              </>
            )
            return (
              <li key={s.id} aria-current={state === 'current' ? 'step' : undefined} className="flex flex-col">
                {state === 'done' && onNavigate ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(i)}
                    className="flex min-h-11 items-center gap-3 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex min-h-11 items-center gap-3">{content}</div>
                )}
                {i < sections.length - 1 && <Connector filled={state === 'done' && i < position.section} />}
              </li>
            )
          })}
        </ol>
      </nav>
    </LayoutGroup>
  )
}

function Marker({ state, animateIn }: { state: State; animateIn: boolean }) {
  const reduce = useReducedMotion()
  return (
    <span className="flex size-8 shrink-0 items-center justify-center">
      {state === 'current' && (
        <motion.span
          // Full motion: the same marker glides between rows. Reduced: it fades in.
          layoutId={reduce ? undefined : 'current-marker'}
          initial={reduce ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={spring.soft}
          className="flex size-8 items-center justify-center rounded-full bg-text"
        >
          <span className="size-2 rounded-full bg-surface" />
        </motion.span>
      )}
      {state === 'done' && (
        <span className="flex size-8 items-center justify-center rounded-full bg-sage-100">
          <motion.span
            className="flex"
            // The check "draws in" left to right. Reduced: fade.
            initial={animateIn ? (reduce ? { opacity: 0 } : { clipPath: 'inset(0 100% 0 0)' }) : false}
            animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0% 0 0)' }}
            transition={spring.quick}
          >
            <CheckIcon size={24} weight="regular" aria-hidden />
          </motion.span>
        </span>
      )}
      {state === 'upcoming' && <span className="size-8 rounded-full border border-border-strong" />}
    </span>
  )
}

function Connector({ filled }: { filled: boolean }) {
  const reduce = useReducedMotion()
  return (
    <span aria-hidden className="flex w-8 justify-center">
      <span className="flex h-4 w-0.5 overflow-hidden rounded-full bg-border-decorative">
        <motion.span
          className="w-full origin-top bg-text"
          initial={false}
          animate={reduce ? { opacity: filled ? 1 : 0 } : { scaleY: filled ? 1 : 0 }}
          transition={spring.soft}
        />
      </span>
    </span>
  )
}

// ---------- compact presentation + sheet ----------

function CompactStepper({ position, onNavigate, completed }: Omit<Props, 'presentation'>) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const section = sections[position.section]
  const count = stepCount(position)

  return (
    <>
      <nav aria-label="Filing progress" className="flex min-w-0 flex-1">
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          <span className="flex items-center gap-2">
            <span className="text-body font-semibold">
              {section.label}
              {count && <span className="sr-only">, step </span>}
            </span>
            {count && <span className="text-small text-text-muted tabular-nums">{count}</span>}
            <span className="sr-only">
              , section {position.section + 1} of {sections.length}. Show all sections
            </span>
            <span className="flex-1" />
            <CaretDownIcon size={24} weight="regular" aria-hidden className="shrink-0" />
          </span>
          <Segments position={position} completed={completed} />
        </button>
      </nav>
      {/* When the sheet finishes closing, focus returns to the button that opened it */}
      <AnimatePresence onExitComplete={() => trigger.current?.focus()}>
        {open && <StepSheet position={position} onNavigate={onNavigate} completed={completed} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

function Segments({ position, completed }: { position: FlowPosition; completed?: Props['completed'] }) {
  const reduce = useReducedMotion()
  return (
    <span aria-hidden className="flex gap-1">
      {sections.map((s, i) => {
        // Done = full. Current = halfway through the current step. Upcoming = empty.
        const state = sectionState(i, position, completed)
        const fill = state === 'done' ? 1 : state === 'current' ? (position.step + 0.5) / position.steps : 0
        return (
          <span key={s.id} className="flex h-1 flex-1 overflow-hidden rounded-full bg-border-decorative">
            <motion.span
              className="w-full origin-left bg-text"
              initial={false}
              animate={reduce ? { scaleX: fill, opacity: fill > 0 ? 1 : 0 } : { scaleX: fill }}
              transition={spring.soft}
            />
          </span>
        )
      })}
    </span>
  )
}

function StepSheet({ position, onNavigate, completed, onClose }: Omit<Props, 'presentation'> & { onClose: () => void }) {
  return (
    <BottomSheet title="Your progress" onClose={onClose}>
      <StepList
        position={position}
        completed={completed}
        group="sheet"
        onNavigate={
          onNavigate
            ? (i) => {
                onNavigate(i)
                onClose()
              }
            : undefined
        }
      />
    </BottomSheet>
  )
}
