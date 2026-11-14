import { MotionConfig } from 'framer-motion'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { SecondaryButton } from '../components/SecondaryButton'
import { Switch } from '../components/Switch'
import { UploadZone, type Drag } from '../components/UploadZone'
import { TAX_YEAR } from '../config'
import { useUpload, type UploadState } from '../lib/upload'
import { IntroContent } from '../intro/IntroContent'

// /motion: play each state of the upload moment, scrub progress, and toggle
// reduced motion. "Upload" and "Error" run REAL uploads to the dev endpoint
// (/api/upload), so progress comes from bytes actually sent. The slider shows
// a chosen progress value instead (scrubbing). Drag states are shown with a
// forced drag, since a page can't fake a real file drag.

const DOC = 'W-2'
const sampleFile = () => new File([new Uint8Array(3 * 1024 * 1024)], `W-2 ${TAX_YEAR}.pdf`, { type: 'application/pdf' })
const scrubFile = { name: `W-2 ${TAX_YEAR}.pdf`, size: 3 * 1024 * 1024 }

type Scene = { state: UploadState; drag?: Drag; label: string }

export default function MotionPage() {
  const [reduced, setReduced] = useState(false)
  const upload = useUpload()
  // A scene overrides the live upload (for idle/drag/static states and scrubbing)
  const [scene, setScene] = useState<Scene | null>({ state: { status: 'idle', progress: 0 }, label: 'Idle' })
  const [scrub, setScrub] = useState(60)

  // Pending steps of "Full sequence"; any other button cancels them (interruptible)
  const timers = useRef<number[]>([])
  const cancel = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const live = scene?.state ?? upload
  const show = (label: string, state: UploadState, drag?: Drag) => {
    cancel()
    upload.reset()
    setScene({ label, state, drag })
  }
  const runUpload = (query = '') => {
    cancel()
    setScene(null)
    upload.start(sampleFile(), query)
  }
  const playAll = () => {
    cancel()
    upload.reset()
    setScene({ label: 'Full sequence', state: { status: 'idle', progress: 0 } })
    // Only the simulated drag is staged; the upload itself is real
    timers.current = [
      window.setTimeout(() => setScene({ label: 'Full sequence', state: { status: 'idle', progress: 0 }, drag: 'page' }), 400),
      window.setTimeout(() => setScene({ label: 'Full sequence', state: { status: 'idle', progress: 0 }, drag: 'zone' }), 1200),
      window.setTimeout(() => {
        timers.current = []
        setScene(null)
        upload.start(sampleFile())
      }, 2200),
    ]
  }

  const current = scene ? scene.label : upload.status === 'error' ? 'Error (real upload)' : 'Real upload'

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <div className="min-h-dvh">
        <div className="sticky top-0 z-10 bg-background/90 pt-(--safe-top) page-x shadow-[inset_0_-1px_0_var(--color-border-decorative)] backdrop-blur">
          <div className="flex min-h-14 page-content flex-wrap items-center justify-between gap-x-4 py-1">
            <p className="text-body font-semibold">Motion</p>
            <Switch label="Reduce motion" on={reduced} onChange={setReduced} />
          </div>
        </div>

        <main className="page-x pb-12">
          <div className="page-content">
            <header className="flex flex-col gap-2 pt-8 pb-12">
              <h1 className="font-display text-display">Upload moment</h1>
              <p className="max-w-column text-body text-text-muted">
                Choreography from MOTION-upload.md, built from our tokens. Upload and Error send a real file to the dev server, so the progress
                line follows real bytes. Use the slider to scrub instead.
              </p>
            </header>

            <section className="page-grid gap-y-8">
              <div className="col-span-full flex flex-col gap-3 tablet:col-span-6 tablet:col-start-2 desktop:col-span-6 desktop:col-start-1">
                <span className="text-small text-text-muted">
                  Showing: <span className="text-text">{current}</span>
                </span>
                <UploadZone
                  docLabel={DOC}
                  status={live.status}
                  progress={live.progress}
                  file={live.file}
                  error={live.error}
                  forceDrag={scene?.drag}
                  onFiles={(files) => {
                    cancel()
                    setScene(null)
                    upload.start(files[0])
                  }}
                  onRetry={() => {
                    cancel()
                    setScene(null)
                    upload.retry()
                  }}
                />
                <p className="text-small text-text-muted">You can also drop a real PDF or photo on the zone, or use Choose a file.</p>
              </div>

              <div className="col-span-full flex flex-col gap-8 tablet:col-span-6 tablet:col-start-2 desktop:col-span-5 desktop:col-start-8">
                <Group title="Play a state">
                  <div className="grid grid-cols-2 gap-3">
                    <SecondaryButton onClick={() => show('Idle', { status: 'idle', progress: 0 })}>Idle</SecondaryButton>
                    <SecondaryButton onClick={() => show('Approach (iPad + laptop)', { status: 'idle', progress: 0 }, 'page')}>Approach</SecondaryButton>
                    <SecondaryButton onClick={() => show('Drag over', { status: 'idle', progress: 0 }, 'zone')}>Drag over</SecondaryButton>
                    <SecondaryButton onClick={() => show('File accepted', { status: 'accepted', progress: 0, file: scrubFile })}>File accepted</SecondaryButton>
                    <SecondaryButton onClick={() => runUpload()}>Upload</SecondaryButton>
                    <SecondaryButton onClick={() => show('Done', { status: 'done', progress: 1, file: scrubFile })}>Done</SecondaryButton>
                    <SecondaryButton onClick={() => runUpload('?fail=1')}>Error</SecondaryButton>
                    <SecondaryButton onClick={playAll}>Full sequence</SecondaryButton>
                  </div>
                </Group>

                <Group title="Scrub uploading">
                  <label className="flex flex-col gap-2">
                    <span className="flex justify-between text-small text-text-muted">
                      <span>Upload progress</span>
                      <span className="tabular-nums">{scrub}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={scrub}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setScrub(v)
                        show('Scrubbing', { status: 'uploading', progress: v / 100, file: scrubFile })
                      }}
                      className="h-11 w-full accent-text"
                    />
                  </label>
                </Group>

                <Group title="Notes">
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-small text-text-muted">
                    <li>Approach hint shows on iPad and laptop only.</li>
                    <li>Only opacity and transform animate; colors never do.</li>
                    <li>Reduce motion: no scale or rise; everything fades in 150ms. Status text stays.</li>
                    <li>Screen readers hear “Uploading W-2”, then “Uploaded”.</li>
                  </ul>
                </Group>
              </div>
            </section>

            <IntroPreview />
          </div>
        </main>
      </div>
    </MotionConfig>
  )
}

// The intro in both compositions. The width toggle sets the device size; the
// intro lays itself out from its own width, so each size shows exactly what
// that device gets (phone below 768, stacked 768–1023, split 1024+). The
// device frame is scaled down to fit this page. Reduce motion above applies.
const DEVICES = [
  { w: 390, h: 844, label: '390 phone' },
  { w: 820, h: 1180, label: '820 iPad' },
  { w: 1032, h: 768, label: '1032 iPad landscape' },
  { w: 1280, h: 800, label: '1280 laptop' },
]

function IntroPreview() {
  const [device, setDevice] = useState(DEVICES[3])
  const [run, setRun] = useState(0)
  const [closed, setClosed] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = avail ? Math.min(1, avail / device.w) : 0
  const restart = () => {
    setClosed(null)
    setRun((n) => n + 1)
  }
  return (
    <section className="mt-12 flex flex-col gap-6 border-t border-border-decorative pt-12">
      <header className="flex flex-col gap-2">
        <h2 className="font-display text-display">Intro</h2>
        <p className="max-w-column text-body text-text-muted">
          Phone and wide (web) compositions of the first-run intro: same scenes, copy and components. Pick a width; Restart plays it from the
          start. On Home, /?intro=reset shows it again.
        </p>
      </header>
      <div role="group" aria-label="Device width" className="flex flex-wrap gap-2">
        {DEVICES.map((d) => (
          <button
            key={d.w}
            type="button"
            aria-pressed={d.w === device.w}
            onClick={() => {
              setDevice(d)
              restart()
            }}
            className={`flex h-11 items-center rounded-sm border px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 ${
              d.w === device.w ? 'border-text bg-surface shadow-[inset_0_0_0_1px_var(--color-text)]' : 'border-border-strong bg-surface'
            }`}
          >
            <span className="tabular-nums">{d.label}</span>
          </button>
        ))}
        <SecondaryButtonInline onClick={restart}>Restart</SecondaryButtonInline>
      </div>
      <div ref={box} className="w-full">
        <div className="overflow-hidden rounded-lg border border-border-strong" style={{ width: device.w * scale, height: device.h * scale }}>
          <div style={{ width: device.w, height: device.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            {closed ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
                <p className="text-body">Intro closed: {closed}</p>
                <SecondaryButtonInline onClick={restart}>Restart</SecondaryButtonInline>
              </div>
            ) : (
              <IntroContent key={`${device.w}-${run}`} onClose={(how) => setClosed(how === 'start' ? 'Get started' : how === 'account' ? 'I already have an account' : 'Skip')} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function SecondaryButtonInline({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
    >
      {children}
    </button>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-title">{title}</h2>
      {children}
    </div>
  )
}
