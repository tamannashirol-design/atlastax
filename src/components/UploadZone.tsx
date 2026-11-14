import { motion, useMotionValue, useReducedMotionConfig, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { formatSize, type UploadFile, type UploadStatus } from '../lib/upload'
import { spring } from '../lib/motion'
import { Folder } from './Folder'

// The upload moment, built from interface elements and tokens only (see
// MOTION-upload.md for the choreography taken from the reference).
//
// The zone is a stack of layers in one grid cell (no absolute positioning).
// State changes only animate opacity and transform; colors never animate:
//   base       surface fill, 1px dashed border-strong          (always)
//   hint       faint navy dashed border, iPad + laptop only     (file dragged over the page)
//   drag-over  primary-tint fill, 1px navy border + scale 1.01  (file over the zone)
//   done       1px success border                               (after the check pops)
//   error      1px error border                                 (failed)
//   progress   1.5px navy line around the edge, clockwise from top center, real progress
//   content    folder (sheet slides in, lifts, check on the front panel) + text:
//              prompt · "Drop to upload" · file name, status, size

export type Drag = 'none' | 'page' | 'zone'

type Props = {
  /** What's being uploaded, e.g. "W-2" */
  docLabel: string
  status: UploadStatus
  progress: number
  file?: UploadFile
  error?: string
  /** false: the failed file can't be sent again (wrong type), so offer "Choose another file" instead of "Try again" */
  retryable?: boolean
  onFiles: (files: File[]) => void
  onRetry: () => void
  /** /motion only: show a drag state without a real drag */
  forceDrag?: Drag
  /** After an upload, offer "Add another file" (forms that come one per employer/client) */
  allowAnother?: boolean
  /** Files uploaded so far on this question (shown in the done status) */
  count?: number
  /** The parent moves focus and makes its own announcements (UploadAnswer), so the zone stays quiet */
  managed?: boolean
}

export function UploadZone({ docLabel, status, progress, file, error, retryable = true, onFiles, onRetry, forceDrag, allowAnother, count = 1, managed = false }: Props) {
  const reduce = useReducedMotionConfig() ?? false
  const t = (s: (typeof spring)[keyof typeof spring]) => (reduce ? spring.fade : s)
  const drag = useDragState(forceDrag)
  const input = useRef<HTMLInputElement>(null)
  const idle = status === 'idle'
  const over = idle && drag.state === 'zone'
  const pct = Math.round(progress * 100)

  const statusText =
    status === 'accepted'
      ? `Starting upload of ${docLabel}`
      : status === 'uploading'
        ? progress >= 1
          ? `Finishing ${docLabel}…`
          : null // rendered below, so only the number gets tabular figures
        : status === 'done'
          ? count > 1
            ? `Uploaded · ${count} files`
            : 'Uploaded'
          : status === 'error'
            ? (error ?? `${docLabel} didn’t upload. Check your connection and try again.`)
            : ''
  // Screen readers hear the moments, not every percent
  const announce = managed ? '' : status === 'accepted' || status === 'uploading' ? `Uploading ${docLabel}` : status === 'done' ? 'Uploaded' : status === 'error' ? statusText : ''

  return (
    <motion.div
      data-stack
      onDragEnter={drag.onZoneEnter}
      onDragLeave={drag.onZoneLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        drag.onDrop(e)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(files)
      }}
      // Drag-over: the zone grows 1% with the soft spring (no scale under reduced motion)
      animate={{ scale: over && !reduce ? 1.01 : 1 }}
      transition={spring.soft}
      className="grid w-full flex-1"
    >
      <div className="rounded-md border border-dashed border-border-strong bg-surface [grid-area:1/1]" />
      <Layer show={idle && drag.state === 'page'} opacity={0.4} transition={t(spring.quick)} className="hidden border-dashed border-text tablet:block" />
      <Layer show={over} transition={t(spring.soft)} className="border-text bg-primary-tint" />
      <Layer show={status === 'done'} transition={{ ...t(spring.quick), delay: reduce ? 0 : 0.3 }} className="border-success" />
      <Layer show={status === 'error'} transition={t(spring.quick)} className="border-error" />
      <ProgressEdge progress={progress} show={status === 'uploading' || status === 'accepted'} handOff={status === 'done'} reduce={reduce} />

      {/* Content: the folder (always present, so it animates between states)
          and below it three text views stacked; hidden ones are inert. */}
      <div className="flex flex-col items-center justify-center gap-4 p-6 [grid-area:1/1]">
        <Folder
          sheetIn={status === 'accepted' || status === 'uploading' || status === 'done'}
          lifted={status === 'accepted' || status === 'uploading'}
          check={status === 'done'}
          reduce={reduce}
        />

        <div className="grid w-full" data-stack>
          <View show={idle && !over} transition={t(spring.quick)}>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex flex-col">
                <span className="text-body font-semibold">Drag your {docLabel} here</span>
                <span className="text-small text-text-muted">A PDF or a clear photo</span>
              </div>
              <button
                type="button"
                data-upload-action
                onClick={() => input.current?.click()}
                className="flex h-11 items-center rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
              >
                Choose a file
              </button>
            </div>
          </View>

          <View show={over} transition={t(spring.quick)}>
            <span className="text-center text-body font-semibold">Drop to upload</span>
          </View>

          <View show={!idle} transition={t(spring.quick)}>
            <div className="flex flex-col items-center gap-3 text-center">
              {/* The status message. Focusable (tabIndex -1) so UploadAnswer can move focus here
                  while uploading and on errors, when the button that started it has gone. */}
              <div
                data-upload-message
                tabIndex={idle ? undefined : -1}
                className="flex max-w-full flex-col rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                <span className="truncate text-body">{file?.name ?? docLabel}</span>
                <span className={`text-small ${status === 'error' ? 'text-error' : status === 'done' ? 'text-success' : 'text-text-muted'}`}>
                  {statusText ?? (
                    <>
                      Uploading {docLabel}, <span className="tabular-nums">{pct}%</span>
                    </>
                  )}
                  {file?.size !== undefined && status !== 'error' && status !== 'done' && <span className="text-text-muted tabular-nums"> · {formatSize(file.size)}</span>}
                </span>
              </div>
              {status === 'done' && allowAnother && (
                <button
                  type="button"
                  data-upload-action
                  onClick={() => input.current?.click()}
                  className="flex h-11 shrink-0 items-center rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
                >
                  Add another file
                </button>
              )}
              {status === 'error' && (
                <button
                  type="button"
                  data-upload-action={retryable ? undefined : true}
                  onClick={retryable ? onRetry : () => input.current?.click()}
                  className="flex h-11 shrink-0 items-center rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
                >
                  {retryable ? 'Try again' : 'Choose another file'}
                </button>
              )}
            </div>
          </View>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      <input
        ref={input}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </motion.div>
  )
}

// ---------- pieces ----------

function Layer({ show, className, transition, opacity = 1 }: { show: boolean; className: string; transition: object; opacity?: number }) {
  return (
    <motion.div
      aria-hidden
      initial={false}
      animate={{ opacity: show ? opacity : 0 }}
      transition={transition}
      className={`pointer-events-none rounded-md border [grid-area:1/1] ${className}`}
    />
  )
}

function View({ show, transition, children }: { show: boolean; transition: object; children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={transition}
      inert={!show}
      aria-hidden={!show}
      className={`grid [grid-area:1/1] ${show ? '' : 'pointer-events-none'}`}
    >
      {children}
    </motion.div>
  )
}

/**
 * Progress line around the zone's edge, clockwise from top center.
 * Driven by real progress, smoothed with the quick spring (no bounce, so it
 * never runs backwards). Built from transform + opacity only: straight edges
 * are thin bars that scale along their length; corners fade in.
 */
function ProgressEdge({ progress, show, handOff, reduce }: { progress: number; show: boolean; handOff: boolean; reduce: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const target = useMotionValue(progress)
  useEffect(() => target.set(progress), [progress, target])
  const smooth = useSpring(target, reduce ? { duration: 0.001, bounce: 0 } : { duration: spring.quick.duration, bounce: 0 })

  const { w, h } = size
  const r = 16 // --radius-md (the zone's corner radius)
  const s = 1.5 // line width = --stroke-1-5
  const q = (Math.PI * r) / 2 // quarter-corner length
  const parts = w && h ? [w / 2 - r, q, h - 2 * r, q, w - 2 * r, q, h - 2 * r, q, w / 2 - r] : []
  const total = parts.reduce((a, b) => a + b, 0)
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, b) => a + b, 0))
  const ra = r - s / 2
  const fracs = parts.map((len, i) => ({ start: starts[i] / total, end: (starts[i] + len) / total }))

  return (
    <motion.svg
      ref={ref}
      aria-hidden
      className="pointer-events-none size-full overflow-visible [grid-area:1/1]"
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      // On done, the line waits for the check to pop, then hands over to the success border. On error it goes at once.
      transition={reduce ? spring.fade : { ...spring.quick, delay: handOff ? 0.3 : 0 }}
    >
      {w > 0 && (
        <g className="fill-text stroke-text">
          <Bar p={smooth} f={fracs[0]} x={w / 2} y={0} width={w / 2 - r} height={s} axis="x" origin={0} />
          <Corner p={smooth} f={fracs[1]} d={`M${w - r} ${s / 2} A${ra} ${ra} 0 0 1 ${w - s / 2} ${r}`} />
          <Bar p={smooth} f={fracs[2]} x={w - s} y={r} width={s} height={h - 2 * r} axis="y" origin={0} />
          <Corner p={smooth} f={fracs[3]} d={`M${w - s / 2} ${h - r} A${ra} ${ra} 0 0 1 ${w - r} ${h - s / 2}`} />
          <Bar p={smooth} f={fracs[4]} x={r} y={h - s} width={w - 2 * r} height={s} axis="x" origin={1} />
          <Corner p={smooth} f={fracs[5]} d={`M${r} ${h - s / 2} A${ra} ${ra} 0 0 1 ${s / 2} ${h - r}`} />
          <Bar p={smooth} f={fracs[6]} x={0} y={r} width={s} height={h - 2 * r} axis="y" origin={1} />
          <Corner p={smooth} f={fracs[7]} d={`M${s / 2} ${r} A${ra} ${ra} 0 0 1 ${r} ${s / 2}`} />
          <Bar p={smooth} f={fracs[8]} x={r} y={0} width={w / 2 - r} height={s} axis="x" origin={0} />
        </g>
      )}
    </motion.svg>
  )
}

type Frac = { start: number; end: number }
const fill = (p: number, f: Frac) => Math.min(1, Math.max(0, (p - f.start) / (f.end - f.start)))

function Bar({ p, f, x, y, width, height, axis, origin }: { p: MotionValue<number>; f: Frac; x: number; y: number; width: number; height: number; axis: 'x' | 'y'; origin: 0 | 1 }) {
  const scale = useTransform(p, (v) => fill(v, f))
  return (
    <motion.rect
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      stroke="none"
      style={axis === 'x' ? { scaleX: scale, originX: origin } : { scaleY: scale, originY: origin }}
    />
  )
}

function Corner({ p, f, d }: { p: MotionValue<number>; f: Frac; d: string }) {
  const opacity = useTransform(p, (v) => fill(v, f))
  return <motion.path d={d} fill="none" style={{ opacity, strokeWidth: 'var(--stroke-1-5)' }} />
}

// ---------- drag tracking ----------
// "page": a file is being dragged anywhere over the window (the approach hint).
// "zone": the file is over the drop zone.
function useDragState(force?: Drag) {
  const [state, setState] = useState<Drag>('none')
  const pageDepth = useRef(0)
  const zoneDepth = useRef(0)
  useEffect(() => {
    const hasFiles = (e: globalThis.DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const enter = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return
      pageDepth.current++
      setState((s) => (s === 'none' ? 'page' : s))
    }
    const leave = () => {
      pageDepth.current = Math.max(0, pageDepth.current - 1)
      if (pageDepth.current === 0) setState('none')
    }
    const end = () => {
      pageDepth.current = 0
      zoneDepth.current = 0
      setState('none')
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', end)
    window.addEventListener('dragend', end)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', end)
      window.removeEventListener('dragend', end)
    }
  }, [])
  return {
    state: force ?? state,
    onZoneEnter: (e: DragEvent) => {
      e.preventDefault()
      zoneDepth.current++
      setState('zone')
    },
    onZoneLeave: () => {
      zoneDepth.current = Math.max(0, zoneDepth.current - 1)
      if (zoneDepth.current === 0) setState(pageDepth.current > 0 ? 'page' : 'none')
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      pageDepth.current = 0
      zoneDepth.current = 0
      setState('none')
    },
  }
}
