import { animate, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { AnswerTile } from '../components/AnswerTile'
import { FormCard } from '../components/FormCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { UploadZone, type Drag } from '../components/UploadZone'
import { TAX_YEAR } from '../config'
import { spring } from '../lib/motion'
import type { UploadFile, UploadStatus } from '../lib/upload'

// The intro's three scenes, built from the real components and motion tokens.
// Each plays its moment when `play` changes (scene shown, or tapped again).
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

// ---------- 1. Visa tiles: one selects itself, the press plays, Continue enables ----------

const VISAS = [
  { value: 'F-1', description: 'Academic' },
  { value: 'J-1', description: 'Exchange' },
  { value: 'M-1', description: 'Vocational' },
]

export function VisaDemo({ play, onTouch, fit }: SceneProps) {
  // A new `play` remounts the run, so it starts from a clean state
  return <VisaRun key={play} play={play} onTouch={onTouch} fit={fit} />
}

function VisaRun({ play, onTouch, fit }: SceneProps) {
  const reduce = useReducedMotionConfig() ?? false
  const [value, setValue] = useState<string | undefined>(reduce ? 'F-1' : undefined)
  const [pressed, setPressed] = useState<string | undefined>()

  useEffect(() => {
    if (reduce) return
    // Tiles settle in (~400ms), a beat, then F-1 is pressed (quick) and selected
    const t1 = window.setTimeout(() => setPressed('F-1'), 1200)
    const t2 = window.setTimeout(() => {
      setPressed(undefined)
      setValue((v) => v ?? 'F-1') // unless the person already picked one
    }, 1450)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [reduce])

  return (
    <DemoBox fit={fit}>
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-3 gap-(--grid-gutter)">
          {VISAS.map((v, i) => (
            <motion.div
              key={`${play}-${v.value}`}
              className="flex"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.soft, delay: reduce ? 0 : i * 0.06 }}
            >
              <div className="flex h-(--answer-h) flex-1 flex-col">
                <AnswerTile
                  code={v.value}
                  description={v.description}
                  selected={value === v.value}
                  forcePressed={pressed === v.value}
                  tabIndex={-1}
                  onSelect={() => {
                    onTouch?.()
                    setValue(v.value)
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
        <PrimaryButton disabled={!value} tabIndex={-1} onClick={onTouch}>
          Continue
        </PrimaryButton>
      </div>
    </DemoBox>
  )
}

// ---------- 2. Upload: a file drops in, the progress line draws, the check lands ----------

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
