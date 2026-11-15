import { AnimatePresence, animate, motion, useReducedMotionConfig } from 'framer-motion'
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { AnswerTile } from '../components/AnswerTile'
import { FormCard } from '../components/FormCard'
import { UploadZone, type Drag } from '../components/UploadZone'
import { TAX_YEAR } from '../config'
import { at, type FlowPosition } from '../flow/sections'
import { spring } from '../lib/motion'
import { PreviewContext } from './previewContext'
import type { UploadFile, UploadStatus } from '../lib/upload'

// The intro's three scenes, built from the real components and motion tokens.
// Each plays its moment when `play` changes (scene shown, or tapped again);
// each exports how long its moment lasts, so the intro can move on 1s after.
// Demo controls are pointer-only (tabIndex -1) and hidden from screen readers:
// keyboard and screen-reader users get the scene's heading and text, and the
// moment plays on its own. Data is obviously generic (W-2, Example Employer).
//
// Reduced motion: nothing moves or plays; each scene shows its finished state
// (tile selected, file uploaded, form ready), so it reads as a still picture.

export type SceneProps = {
  /** Changes whenever the scene should (re)play */
  play: number
  /** Called on any tap inside the demo (stops the intro's auto-advance) */
  onTouch?: () => void
  /** "box" (phone intro): centered in the fixed 296 demo box. "content": top-aligned, own height (the laptop preview's answer area). */
  fit?: 'box' | 'content'
}

/** Every demo sits in the same fixed box (the upload answer height), so text and buttons never move between scenes.
 *  onReplay: a tap on the demo (but not on one of its buttons, which play their own press) replays the moment. */
function DemoBox({ children, onReplay, fit = 'box' }: { children: ReactNode; onReplay?: () => void; fit?: SceneProps['fit'] }) {
  return (
    <div
      aria-hidden
      onClick={(e) => {
        if (onReplay && !(e.target as Element).closest('button')) onReplay()
      }}
      className={`flex w-full flex-col ${fit === 'box' ? 'h-(--answer-h-upload) justify-center' : ''}`}
    >
      {children}
    </div>
  )
}

// ---------- 1. Two questions: tiles appear, one is picked, then the next question ----------
// No Continue button: just the question, its answer tiles and a tile being
// picked, twice. In the laptop preview the rail follows the question.
//   0      Q1 tiles settle in (soft, 60ms stagger)
//   1000   F-1 pressed (quick) → 1250 selected
//   2000   cross-fade to Q2 (soft); tiles settle in
//   3000   "Yes" pressed → 3250 selected   (moment ends ~3400)

type Q = { question: string; helper: string; position: FlowPosition; options: { code: string; description: string }[]; pick: string }

const QUESTIONS: Q[] = [
  {
    question: 'What is your visa type?',
    helper: 'To personalize the experience and show only visa‑relevant forms',
    position: at('about', 0, 4),
    options: [
      { code: 'F-1', description: 'Academic' },
      { code: 'J-1', description: 'Exchange' },
      { code: 'M-1', description: 'Vocational' },
    ],
    pick: 'F-1',
  },
  {
    question: 'Are you currently enrolled at a U.S. university or college?',
    helper: 'To check your student status for the right forms',
    position: at('about', 1, 4),
    options: [
      { code: 'Yes', description: '' },
      { code: 'No', description: '' },
    ],
    pick: 'Yes',
  },
]

/** How long scene 1's moment lasts (the intro moves on 1s after). */
export const QUESTIONS_MOMENT_MS = 3400

export function VisaDemo({ play, fit }: SceneProps) {
  // A new `play` remounts the run, so it starts from a clean state
  return <QuestionsRun key={play} play={play} fit={fit} />
}

function QuestionsRun({ fit }: SceneProps) {
  const reduce = useReducedMotionConfig() ?? false
  const preview = useContext(PreviewContext)
  const [q, setQ] = useState(0)
  const [picked, setPicked] = useState<string | undefined>(reduce ? QUESTIONS[0].pick : undefined)
  const [pressed, setPressed] = useState<string | undefined>()

  useEffect(() => {
    if (reduce) return
    const at = (ms: number, f: () => void) => window.setTimeout(f, ms)
    const timers = [
      at(1000, () => setPressed(QUESTIONS[0].pick)),
      at(1250, () => {
        setPressed(undefined)
        setPicked(QUESTIONS[0].pick)
      }),
      at(2000, () => {
        setQ(1)
        setPicked(undefined)
        preview?.setPosition(QUESTIONS[1].position)
      }),
      at(3000, () => setPressed(QUESTIONS[1].pick)),
      at(3250, () => {
        setPressed(undefined)
        setPicked(QUESTIONS[1].pick)
      }),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reduce, preview])

  const laptop = fit === 'content'
  const current = QUESTIONS[q]
  return (
    <DemoBox fit={fit}>
      <div data-stack className="grid">
        <AnimatePresence initial={false}>
          <motion.div
            key={q}
            className="flex flex-col [grid-area:1/1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? spring.fade : spring.soft}
          >
            {laptop ? (
              <>
                <span className="font-display text-display">{current.question}</span>
                <span className="mt-2 text-small text-text-muted">{current.helper}</span>
              </>
            ) : (
              <span className="font-display text-title">{current.question}</span>
            )}
            <div className={`grid gap-(--grid-gutter) ${laptop ? 'mt-10' : 'mt-4'}`} style={{ gridTemplateColumns: `repeat(${current.options.length}, minmax(0, 1fr))` }}>
              {current.options.map((o, i) => (
                <motion.div
                  key={o.code}
                  className="flex h-(--answer-h) flex-col"
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.soft, delay: reduce ? 0 : i * 0.06 }}
                >
                  <AnswerTile code={o.code} description={o.description || undefined} selected={picked === o.code} forcePressed={pressed === o.code} tabIndex={-1} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </DemoBox>
  )
}

// ---------- 2. Upload: a file drops in, the progress line draws, the check lands ----------

/** Upload: drag 500 → accepted 1200 → progress 1400–3000 → check (moment ends ~3400). */
export const UPLOAD_MOMENT_MS = 3400

const DEMO_FILE: UploadFile = { name: 'W-2 · Example Employer.pdf', size: 240 * 1024 }

export function UploadDemo({ play, onTouch, fit }: SceneProps) {
  const [replay, setReplay] = useState(0)
  return (
    <DemoBox
      fit={fit}
      onReplay={() => {
        onTouch?.()
        setReplay((n) => n + 1)
      }}
    >
      <div className={`flex flex-col ${fit === 'content' ? 'h-(--answer-h-upload)' : 'flex-1'}`}>
        <UploadRun key={`${play}-${replay}`} />
      </div>
    </DemoBox>
  )
}

function UploadRun() {
  const reduce = useReducedMotionConfig() ?? false
  const [state, setState] = useState<{ status: UploadStatus; progress: number; drag: Drag }>(
    reduce ? { status: 'done', progress: 1, drag: 'none' } : { status: 'idle', progress: 0, drag: 'none' },
  )

  useEffect(() => {
    if (reduce) return
    // A scripted stand-in for an upload: the intro never sends a file anywhere.
    // (Real upload questions always take progress from a real upload.)
    let stop = () => {}
    const t1 = window.setTimeout(() => setState({ status: 'idle', progress: 0, drag: 'zone' }), 500)
    const t2 = window.setTimeout(() => {
      setState({ status: 'accepted', progress: 0, drag: 'none' })
      const run = animate(0, 1, {
        duration: 1.6,
        ease: 'linear',
        delay: 0.2,
        onUpdate: (p) => setState({ status: 'uploading', progress: p, drag: 'none' }),
        onComplete: () => setState({ status: 'done', progress: 1, drag: 'none' }),
      })
      stop = () => run.stop()
    }, 1200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      stop()
    }
  }, [reduce])

  return (
    // inert: the zone's own buttons aren't reachable; a tap anywhere replays the moment
    <div inert className="flex flex-1 flex-col">
      <UploadZone
        docLabel="W-2"
        status={state.status}
        progress={state.progress}
        file={state.status === 'idle' ? undefined : DEMO_FILE}
        forceDrag={state.drag}
        onFiles={() => {}}
        onRetry={() => {}}
        managed
      />
    </div>
  )
}

// ---------- 3. A finished form card settles in, ready to download ----------

/** The card settles in (soft, 400ms). */
export const FORM_MOMENT_MS = 600

export function FormDemo({ play, onTouch, fit }: SceneProps) {
  const [replay, setReplay] = useState(0)
  return (
    <DemoBox
      fit={fit}
      onReplay={() => {
        onTouch?.()
        setReplay((n) => n + 1)
      }}
    >
      <FormCard
        key={`${play}-${replay}`}
        form="Form 1040‑NR"
        title={`U.S. Nonresident Alien Income Tax Return · ${TAX_YEAR}`}
        note="Example data"
        tabIndex={-1}
        onDownload={onTouch}
      />
    </DemoBox>
  )
}
