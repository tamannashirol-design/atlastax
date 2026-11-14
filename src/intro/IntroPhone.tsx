import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Logo } from '../components/Logo'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { StepDots } from '../components/StepDots'
import { spring } from '../lib/motion'
import { LoginLink, PageFooter, WHO_FOR, type IntroMode } from './chrome'
import { SCENE_GAP_MS, scenes } from './content'
import { gridStyle, questionColumn, type Frame } from './frame'
import type { IntroExit } from './Intro'

// Phone composition of the intro (below 768px): full-screen scenes.
//
// mode "page" (the logged-out entry page, "/"):
//   header  logo · step dots
//   main    the scene (scrolls if needed): demo 296, 40, heading, 8, text
//   bottom  who it's for · Get started (the one cobalt button) · Log in · footer
// mode "replay" (from Help on Home, in a dialog):
//   top     step dots · Skip            bottom  Next · last scene: Get started
//
// Moving: swipe or ← → (and Next in replay). Scenes move on 1s after their
// moment ends, until the person touches or presses anything; never with
// reduced motion (finished states, 150ms cross-fades). Escape skips (replay).
// Live region: "Step 2 of 3: Add your documents". If the focused button
// disappears (Next ↔ Get started), focus moves to the one replacing it.

const SWIPE_PX = 48

export function IntroPhone({ frame, mode, onClose }: { frame: Frame; mode: IntroMode; onClose: (how: IntroExit) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotionConfig() ?? false
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [touched, setTouched] = useState(false)
  const [announce, setAnnounce] = useState('')
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const nextBtn = useRef<HTMLDivElement>(null)
  const startBtn = useRef<HTMLDivElement>(null)
  const page = mode === 'page'
  const last = index === scenes.length - 1
  const scene = scenes[index]

  const go = (to: number) => {
    if (to < 0 || to >= scenes.length || to === index) return
    setDir(to > index ? 1 : -1)
    setIndex(to)
    setAnnounce(`Step ${to + 1} of ${scenes.length}: ${scenes[to].title}`)
  }

  // If the focused button went away (Next ↔ Get started), focus the one that replaced it.
  // Layout effect: before paint, so focus never rests on the body.
  useLayoutEffect(() => {
    if (page) return
    const active = document.activeElement
    const lost = !active || active === document.body || !ref.current?.contains(active)
    if (lost) (startBtn.current ?? nextBtn.current)?.querySelector('button')?.focus()
  }, [last, page])

  // Move on 1s after the scene's moment ends, until touched; never with reduced motion or from the last scene
  useEffect(() => {
    if (touched || reduce || last) return
    const t = window.setTimeout(() => go(index + 1), scene.moment + SCENE_GAP_MS)
    return () => clearTimeout(t)
  })

  const onKeyDown = (e: KeyboardEvent) => {
    setTouched(true)
    if (e.key === 'Escape' && !page) {
      e.preventDefault()
      onClose('skip')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(index - 1)
    } else if (e.key === 'Enter' && !(e.target as Element).closest('button, a')) {
      e.preventDefault()
      if (!last) go(index + 1)
      else if (!page) onClose('start')
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

  const col = questionColumn(frame)
  const t = reduce ? spring.fade : spring.soft
  const Top = page ? 'header' : 'div'
  const Middle = page ? 'main' : 'div'

  return (
    <div ref={ref} data-intro-root tabIndex={-1} onKeyDown={onKeyDown} className="flex h-full flex-col outline-none">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
        <Top className="pt-(--safe-top) page-x">
          <div className="grid page-content gap-x-(--grid-gutter)" style={gridStyle(frame)}>
            <div className="flex h-(--top-bar-h) items-center justify-between" style={col}>
              {page ? (
                <>
                  <Logo />
                  <StepDots current={index} total={scenes.length} />
                </>
              ) : (
                <>
                  <StepDots current={index} total={scenes.length} />
                  <button
                    type="button"
                    onClick={() => onClose('skip')}
                    className="flex h-11 items-center rounded-sm px-2 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
          </div>
        </Top>

        {/* The scene. Swipe anywhere here. */}
        <Middle className="flex min-h-0 flex-col overflow-y-auto page-x" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: 'pan-y' }}>
          <div className="grid page-content flex-1 content-center gap-x-(--grid-gutter) py-6" style={gridStyle(frame)}>
            <div data-stack className="grid" style={col}>
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
                  {/* Reserves 3 heading lines + 2 text lines on 4 columns (176), 2 + 2 on 8 (136), so nothing shifts between scenes */}
                  <div className={`mt-10 flex flex-col gap-2 ${frame.cols === 4 ? 'min-h-44' : 'min-h-34'}`}>
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
        </Middle>

        <div className="pb-(--safe-bottom) page-x">
          <div className="grid page-content gap-x-(--grid-gutter)" style={gridStyle(frame)}>
            {page ? (
              <div className="flex flex-col gap-2 pt-2 pb-2" style={col}>
                <p className="pb-2 text-center text-small text-text-muted">{WHO_FOR}</p>
                <PrimaryButton onClick={() => onClose('start')}>Get started</PrimaryButton>
                <LoginLink onClick={() => onClose('login')} />
                <PageFooter center />
              </div>
            ) : (
              // Fixed height (56 + 8 + 48) so nothing jumps on the last scene
              <div className="flex min-h-28 flex-col gap-2 pt-2 pb-6" style={col}>
                {last ? (
                  <div ref={startBtn} className="flex flex-col">
                    <PrimaryButton onClick={() => onClose('start')}>Get started</PrimaryButton>
                  </div>
                ) : (
                  <div ref={nextBtn} className="flex flex-col">
                    <SecondaryButton onClick={() => go(index + 1)}>Next</SecondaryButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Read when the replay dialog opens (aria-describedby on the dialog) */}
      <p id="intro-description" className="sr-only">
        {`Step ${index + 1} of ${scenes.length}: ${scene.title}. ${scene.body}`}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  )
}
