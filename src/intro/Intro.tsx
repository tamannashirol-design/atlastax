import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { StepDots } from '../components/StepDots'
import { spring } from '../lib/motion'
import { scenes } from './content'

// First-run intro: three scenes made of the real components (see scenes.tsx).
// A modal <dialog> over Home: traps focus, Escape skips, the page behind is inert.
//
// Layout = the app shell's three rows, on the question column (6 of 8/12
// columns, centered on iPad and laptop; full width on phone):
//   top    56 + safe area: step indicator · Skip (always visible)
//   middle the scene (only part that scrolls): demo 296, 40, heading, 8, text
//   bottom Next (secondary) · last scene: Get started (the one cobalt button)
//          + "I already have an account"
//
// Moving: Next, swipe left/right, ← →. Enter on a non-button = Next.
// Auto-advance after 5s, but only until the person touches or presses
// anything, and never with reduced motion.
// Motion: scenes push sideways (soft spring, 40pt + fade); reduced motion:
// a 150ms cross-fade, nothing moves.
// Screen readers: each scene has a heading; the live region announces
// "Step 2 of 3: Add your documents". On open, focus is on the dialog itself
// (its label is the scene heading). If the focused button disappears (Next
// gives way to Get started, or back), focus moves to the one replacing it. On close, whoever
// opened the intro decides where focus goes (Home focuses its main action).

export type IntroExit = 'skip' | 'start' | 'account'

const AUTO_ADVANCE_MS = 5000
const SWIPE_PX = 48

export function Intro({ onClose }: { onClose: (how: IntroExit) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const reduce = useReducedMotionConfig() ?? false
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [touched, setTouched] = useState(false)
  const [announce, setAnnounce] = useState('')
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const nextBtn = useRef<HTMLDivElement>(null)
  const startBtn = useRef<HTMLDivElement>(null)
  const last = index === scenes.length - 1
  const scene = scenes[index]

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    // Focus the dialog itself: screen readers hear the scene's title and text,
    // no focus ring flashes on a button nobody pressed, and Tab goes to Skip next
    d?.focus()
  }, [])

  const go = (to: number) => {
    if (to < 0 || to >= scenes.length || to === index) return
    setDir(to > index ? 1 : -1)
    setIndex(to)
    setAnnounce(`Step ${to + 1} of ${scenes.length}: ${scenes[to].title}`)
  }

  // If the focused button went away (Next ↔ Get started), focus the one that replaced it.
  // Layout effect: before paint, so focus never rests on the body.
  useLayoutEffect(() => {
    const active = document.activeElement
    const lost = !active || active === document.body || !ref.current?.contains(active)
    if (lost) (startBtn.current ?? nextBtn.current)?.querySelector('button')?.focus()
  }, [last])

  // Auto-advance until touched; never with reduced motion or on the last scene
  useEffect(() => {
    if (touched || reduce || last) return
    const t = window.setTimeout(() => go(index + 1), AUTO_ADVANCE_MS)
    return () => clearTimeout(t)
  })

  const onKeyDown = (e: KeyboardEvent) => {
    setTouched(true)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(index - 1)
    } else if (e.key === 'Enter' && !(e.target as Element).closest('button, a')) {
      e.preventDefault()
      if (last) onClose('start')
      else go(index + 1)
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    setTouched(true)
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1))
  }

  const column = 'col-span-full tablet:col-span-6 tablet:col-start-2 desktop:col-start-4'
  const t = reduce ? spring.fade : spring.soft

  return (
    <motion.dialog
      ref={ref}
      aria-labelledby={`intro-${scene.id}`}
      aria-describedby={`intro-${scene.id}-body`}
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault()
        onClose('skip')
      }}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? spring.fade : spring.quick}
      className="m-0 size-full max-h-none max-w-none bg-background p-0 text-text outline-none backdrop:bg-transparent"
    >
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
        {/* Top: indicator + Skip */}
        <div className="pt-(--safe-top) page-x">
          <div className="page-content page-grid">
            <div className={`flex h-(--top-bar-h) items-center justify-between ${column}`}>
              <StepDots current={index} total={scenes.length} />
              <button
                type="button"
                onClick={() => onClose('skip')}
                className="flex h-11 items-center rounded-sm px-2 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                Skip
              </button>
            </div>
          </div>
        </div>

        {/* Middle: the scene. Swipe anywhere here. */}
        <div className="flex min-h-0 flex-col overflow-y-auto page-x" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: 'pan-y' }}>
          <div className="page-content page-grid flex-1 content-center py-6">
            <div data-stack className={`grid ${column}`}>
              <AnimatePresence initial={false} custom={dir}>
                <motion.section
                  key={scene.id}
                  aria-labelledby={`intro-${scene.id}`}
                  custom={dir}
                  variants={{
                    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 40 * d }),
                    center: { opacity: 1, x: 0 },
                    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -40 * d }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={t}
                  className="flex flex-col [grid-area:1/1]"
                >
                  <scene.Demo play={index} onTouch={() => setTouched(true)} />
                  {/* Reserves 3 heading lines + 2 text lines on phone (176), 2 + 2 at 600px+ (136), so nothing shifts between scenes */}
                  <div className="mt-10 flex min-h-44 flex-col gap-2 tablet:min-h-34">
                    <h2 id={`intro-${scene.id}`} className="font-display text-display text-balance">
                      {scene.title}
                    </h2>
                    <p id={`intro-${scene.id}-body`} className="text-body text-text-muted">
                      {scene.body}
                    </p>
                  </div>
                </motion.section>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bottom: actions. Fixed height (56 + 8 + 48) so nothing jumps on the last scene. */}
        <div className="pb-(--safe-bottom) page-x">
          <div className="page-content page-grid">
            <div className={`flex min-h-28 flex-col gap-2 pt-2 pb-6 ${column}`}>
              {last ? (
                <>
                  <div ref={startBtn} className="flex flex-col">
                    <PrimaryButton onClick={() => onClose('start')}>Get started</PrimaryButton>
                  </div>
                  {/* TODO confirm: there are no accounts yet; this closes the intro like Skip */}
                  <button
                    type="button"
                    onClick={() => onClose('account')}
                    className="flex min-h-12 items-center justify-center rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                  >
                    I already have an account
                  </button>
                </>
              ) : (
                <div ref={nextBtn} className="flex flex-col">
                  <SecondaryButton onClick={() => go(index + 1)}>Next</SecondaryButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </motion.dialog>
  )
}
