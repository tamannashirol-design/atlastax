import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotionConfig, type MotionValue } from 'framer-motion'
import { useRef, useState, type KeyboardEvent } from 'react'
import { Logo } from '../components/Logo'
import { PrimaryButton } from '../components/PrimaryButton'
import { spring } from '../lib/motion'
import { LoginLink, PageFooter, type IntroMode } from './chrome'
import { SCENE_GAP_MS, scenes } from './content'
import { gridStyle, type Frame } from './frame'
import type { IntroExit } from './Intro'
import { LaptopPreview } from './LaptopPreview'

// Wide composition of the intro ("web intro", 768px and up). Same scenes,
// copy and components as the phone; only the layout changes.
//
// Split (1024 and up), on the 12-column grid:
//   columns 1–5  the steps as a vertical tablist. The active step shows its
//                heading and sentence, the others only their heading. A thin
//                navy line fills beside the active step while it plays.
//                At the bottom: Get started (the one cobalt button) and Skip.
//   columns 6–12 the demo panel: the real laptop layout
//                (stepper rail + question column) in a card (LaptopPreview).
// Stacked (768–1023, iPad portrait), on 8 columns: the steps become a row of
// tabs (line fills underneath), the active sentence, the demo, then actions.
//
// mode "page" (the logged-out entry page, "/"): logo on top, the "who it's
// for" line above the steps, Get started + a quiet Log in, and a footer
// (Privacy, Terms, Contact). mode "replay" (from Help, in a dialog): Get
// started + Skip; Escape leaves.
//
// Behaviour: clicking a step jumps to it. Each scene moves on 1s after its
// moment ends (the line fills over that time), pauses while the pointer is
// over the steps or the demo or while focus is inside, and stops for good
// after the first click or key press. Reduced motion: no auto-advance, no
// movement, 150ms fades; the active line shows full.
// Screen readers: tablist (arrow keys, Home/End), a demo panel labelled by
// its tab whose demo is hidden but described in text, a polite live region,
// Escape or Skip leaves (replay).

export function IntroWide({ frame, mode, onClose }: { frame: Frame; mode: IntroMode; onClose: (how: IntroExit) => void }) {
  const page = mode === 'page'
  const reduce = useReducedMotionConfig() ?? false
  const [index, setIndex] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [hover, setHover] = useState(false)
  const [focusIn, setFocusIn] = useState(false)
  const [announce, setAnnounce] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const elapsed = useRef(0)
  const fill = useMotionValue(0)
  const auto = !stopped && !reduce
  const scene = scenes[index]

  const select = (i: number, byPerson: boolean) => {
    if (byPerson) setStopped(true)
    if (i === index) return
    elapsed.current = 0
    fill.set(0)
    setIndex(i)
    setAnnounce(`Step ${i + 1} of ${scenes.length}: ${scenes[i].title}`)
  }

  // One clock drives both the line and the advance, so they can't drift apart
  useAnimationFrame((_, delta) => {
    if (!auto || hover || focusIn) return
    elapsed.current += delta
    const p = Math.min(1, elapsed.current / (scenes[index].moment + SCENE_GAP_MS))
    fill.set(p)
    if (p >= 1) {
      if (index < scenes.length - 1) select(index + 1, false)
      else setStopped(true) // last scene: stay
    }
  })

  const onTabKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys = frame.split ? { prev: ['ArrowUp', 'ArrowLeft'], next: ['ArrowDown', 'ArrowRight'] } : { prev: ['ArrowLeft'], next: ['ArrowRight'] }
    let to: number | null = null
    if (keys.next.includes(e.key)) to = (i + 1) % scenes.length
    else if (keys.prev.includes(e.key)) to = (i - 1 + scenes.length) % scenes.length
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = scenes.length - 1
    if (to === null) return
    e.preventDefault()
    select(to, true)
    tabs.current[to]?.focus()
  }

  const fade = reduce ? spring.fade : spring.soft
  const hoverProps = {
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
  }

  const tabList = (
    <div
      role="tablist"
      aria-label="Intro steps"
      aria-orientation={frame.split ? 'vertical' : 'horizontal'}
      {...hoverProps}
      className={frame.split ? 'flex flex-col gap-2' : 'flex gap-(--grid-gutter)'}
    >
      {scenes.map((s, i) => {
        const active = i === index
        return (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`intro-tab-${s.id}`}
            aria-selected={active}
            aria-controls="intro-panel"
            aria-labelledby={`intro-tab-${s.id}-title`}
            aria-describedby={active ? `intro-${s.id}-sentence` : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => select(i, true)}
            onKeyDown={onTabKey(i)}
            className={`rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text ${
              frame.split ? 'grid grid-cols-[2px_minmax(0,1fr)] gap-x-4 py-3' : 'flex min-h-11 flex-1 flex-col gap-3'
            }`}
          >
            <ProgressLine active={active} fill={fill} full={!auto} vertical={frame.split} reduce={reduce} />
            <span className="flex min-w-0 flex-col gap-2">
              <span
                id={`intro-tab-${s.id}-title`}
                className={
                  frame.split ? `font-display text-title ${active ? '' : 'text-text-muted'}` : `text-body font-semibold ${active ? '' : 'text-text-muted'}`
                }
              >
                {s.title}
              </span>
              {frame.split && active && (
                <motion.span
                  id={`intro-${s.id}-sentence`}
                  className="text-body text-text-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={fade}
                >
                  {s.body}
                </motion.span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )

  const panel = (
    <div className="flex flex-col gap-3">
      <div
        role="tabpanel"
        id="intro-panel"
        aria-labelledby={`intro-tab-${scene.id}`}
        tabIndex={0}
        {...hoverProps}
        className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        <p className="sr-only">{scene.demoText}</p>
        {/* Scenes cross-fade in one grid cell; their own pieces keep the existing stagger */}
        {/* minmax(0,1fr) + min-w-0: the full-size preview canvas must not widen the column before it's scaled */}
        <div data-stack aria-hidden className="grid grid-cols-[minmax(0,1fr)]">
          <AnimatePresence initial={false}>
            <motion.div
              key={scene.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="min-w-0 [grid-area:1/1]"
              // A scaled preview isn't clickable (its controls would be tiny); the moments play on their own
              inert
            >
              <LaptopPreview {...scene.preview}>
                <scene.Demo play={index} fit="content" />
              </LaptopPreview>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )

  const actions = (
    <div className="flex flex-col gap-2">
      <PrimaryButton onClick={() => onClose('start')}>Get started</PrimaryButton>
      {page ? (
        <LoginLink onClick={() => onClose('login')} />
      ) : (
        <button
          type="button"
          onClick={() => onClose('skip')}
          className="flex min-h-12 items-center justify-center rounded-sm text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          Skip
        </button>
      )}
    </div>
  )
  const Body = page ? 'main' : 'div'

  return (
    <div
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !page) {
          e.preventDefault()
          onClose('skip')
        } else if (e.key !== 'Tab' && e.key !== 'Shift') setStopped(true)
      }}
      onPointerDown={() => setStopped(true)}
      data-intro-root
      tabIndex={-1}
      // Pause while focus is on something inside (not the root itself, which gets focus on open)
      onFocus={(e) => setFocusIn(e.target !== e.currentTarget)}
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null
        if (!to || to === root.current || !root.current?.contains(to)) setFocusIn(false)
      }}
      className="flex h-full flex-col overflow-y-auto pt-(--safe-top) pb-(--safe-bottom) outline-none page-x"
    >
      {page && (
        <header className="page-content flex h-(--top-bar-h) shrink-0 items-center justify-between">
          <Logo />
        </header>
      )}
      {/* Read when the replay dialog opens (aria-describedby on the dialog) */}
      <p id="intro-description" className="sr-only">
        {`Step ${index + 1} of ${scenes.length}: ${scene.title}. ${scene.body}`}
      </p>

      {frame.split ? (
        // Order in the page (and for Tab): steps → demo panel → actions, as the tabs pattern expects.
        // Placed on the grid so the actions still sit at the bottom of the left column.
        // Centered vertically (justify-center, no auto margins, so spacing stays on the 4pt grid); scrolls if too short.
        <Body className="flex flex-1 flex-col justify-center">
          <div className="grid page-content grid-rows-[auto_1fr] gap-x-(--grid-gutter) gap-y-10 py-12" style={gridStyle(frame)}>
            <div style={{ gridColumn: '1 / span 5', gridRow: 1 }}>
              {tabList}
            </div>
            <div style={{ gridColumn: '6 / span 7', gridRow: '1 / span 2' }}>{panel}</div>
            <div className="self-end" style={{ gridColumn: '1 / span 5', gridRow: 2 }}>
              {actions}
            </div>
          </div>
        </Body>
      ) : (
        <Body className="flex flex-1 flex-col justify-center">
          <div className="grid page-content gap-x-(--grid-gutter) py-12" style={gridStyle(frame)}>
            <div style={{ gridColumn: '1 / -1' }}>
              {tabList}
            </div>
            {/* Active sentence: reserves 2 lines so the demo doesn't move between steps */}
            <div data-stack className="mt-4 grid min-h-12" style={{ gridColumn: '1 / -1' }}>
              <AnimatePresence initial={false}>
                <motion.p
                  key={scene.id}
                  id={`intro-${scene.id}-sentence`}
                  className="text-body text-text-muted [grid-area:1/1]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                >
                  {scene.body}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="mt-6" style={{ gridColumn: '1 / -1' }}>
              {panel}
            </div>
            <div className="mt-8" style={{ gridColumn: '3 / span 4' }}>
              {actions}
            </div>
          </div>
        </Body>
      )}

      {page && (
        <div className="page-content shrink-0 pb-4">
          <PageFooter center={!frame.split} />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  )
}

/** Thin navy line beside (split) or under (stacked) a step. Track = sage; fill = navy, grows with a transform. */
function ProgressLine({
  active,
  fill,
  full,
  vertical,
  reduce,
}: {
  active: boolean
  fill: MotionValue<number>
  full: boolean
  vertical: boolean
  reduce: boolean
}) {
  return (
    <span aria-hidden data-stack className={`grid ${vertical ? 'h-full w-0.5' : 'h-1 w-full'}`}>
      <span className="rounded-full bg-border-decorative [grid-area:1/1]" />
      <motion.span
        className="rounded-full bg-text [grid-area:1/1]"
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={reduce ? spring.fade : spring.quick}
        style={vertical ? { scaleY: full ? 1 : fill, originY: 0 } : { scaleX: full ? 1 : fill, originX: 0 }}
      />
    </span>
  )
}
