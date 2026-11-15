import { CheckIcon, CircleDashedIcon } from '@phosphor-icons/react'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { useRef, useState, type DragEvent } from 'react'
import type { Art } from '../data/income'
import { spring } from '../lib/motion'

// One document on the Documents page: a friendly card, not a form row.
//   illustration (the designer's art: 80px phone, 96px from 600px)
//   name · one-line hint                                         [Added]
//   The pill sits top-right, level with the name, so the card keeps its size
//   when a document is added (text + icon, never color alone)
//   one action: a soft "Add" (primary tint, navy text; never cobalt) or
//   "Replace" (income without a form: a quiet "Remind me later" / Undo)
// The whole card is a drop zone (iPad and laptop): dragging a file over it
// eases in a primary-tint fill with "Drop to add"; dropping opens the upload
// sheet with the file already uploading. Add stays for keyboard and phone.
// White surface, radius lg, faint sage border + soft shadow; 24 padding.

// Pills only where they say something: "Added" once uploaded, and "Details
// needed" on income without a form (it has no Add). Nothing while not added:
// the card just shows "Add".
export type Pill = 'added' | 'details'

const PILLS: Record<Pill, { text: string; Icon: typeof CheckIcon; cls: string }> = {
  added: { text: 'Added', Icon: CheckIcon, cls: 'border border-success bg-surface text-success' },
  details: { text: 'Details needed', Icon: CircleDashedIcon, cls: 'bg-sage-100 text-text' },
}

type Props = {
  id: string
  name: string
  optional?: boolean
  /** One-line hint (unchanged once added, so the card keeps its size) */
  hint: string
  /** The designer's illustration (decorative); see documents/artwork.ts */
  art?: Art
  pill?: Pill
  /** The one action: Add / Replace. Omit for items that can't be added (self-reported income). */
  primary?: { label: string; onClick: () => void }
  /** A quiet secondary (income without a form: "Remind me later" / Undo) */
  secondary?: { kind: 'button'; label: string; onClick: () => void }
  /** Dropping a file on the card */
  onDropFile?: (file: File) => void
  index: number
}

export function DocumentCard({ id, name, optional, hint, art, pill, primary, secondary, onDropFile, index }: Props) {
  const reduce = useReducedMotionConfig() ?? false
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const drop = onDropFile
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          depth.current++
          setOver(true)
        },
        onDragOver: (e: DragEvent) => e.preventDefault(),
        onDragLeave: () => {
          depth.current = Math.max(0, depth.current - 1)
          if (!depth.current) setOver(false)
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          depth.current = 0
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onDropFile(f)
        },
      }
    : {}

  return (
    <motion.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? spring.fade : { ...spring.soft, delay: 0.06 + index * 0.05 }}
      className="flex min-w-0"
    >
      <section
        id={`item-${id}`}
        tabIndex={-1}
        aria-labelledby={`item-${id}-title`}
        {...drop}
        data-stack
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] rounded-lg border border-border-decorative bg-surface shadow-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        <div className="flex flex-col gap-4 p-6 [grid-area:1/1]">
          {/* Illustration on its own row, then [name + hint] [pill]: the name gets the card's full width beside the pill */}
          {art && <Illustration art={art} />}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="flex min-w-0 flex-col">
              <h3 id={`item-${id}-title`} className="text-body font-semibold">
                {/* Keep hyphenated names together (I-94, W-2): an invisible word joiner on each side of the hyphen */}
                {name.replace(/(\S)-(?=\S)/g, '$1\u2060-\u2060')}
                {/* Optional is said by the pill ("Optional") and the hint; screen readers hear it with the name */}
                {optional && <span className="sr-only"> (optional)</span>}
              </h3>
              <p className="text-small text-text-muted [overflow-wrap:anywhere]">{hint}</p>
            </div>
            {/* "Added": top-right, level with the name (same 24pt line height). Its space is reserved on every card that can be
                added (invisible until then), so the text column never changes width and the card never changes size. */}
            <span className="flex">
              {pill === 'added' ? <StatusPill pill={pill} /> : primary && <StatusPill pill="added" placeholder />}
            </span>
          </div>
          {/* "Details needed" (income without a form, which is never uploaded) sits under the name: it's too wide for the corner on narrow cards */}
          {pill === 'details' && <StatusPill pill={pill} />}
          {(primary || secondary) && (
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
              {primary && (
                <button
                  type="button"
                  onClick={primary.onClick}
                  className="flex h-11 items-center rounded-sm bg-primary-tint px-5 text-body font-semibold text-text transition-colors active:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                >
                  {primary.label}
                  <span className="sr-only"> {name}</span>
                </button>
              )}
              {secondary?.kind === 'button' && (
                <button
                  type="button"
                  onClick={secondary.onClick}
                  className="flex min-h-11 items-center rounded-sm px-1 text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                >
                  {secondary.label}
                  <span className="sr-only"> for {name}</span>
                </button>
              )}
            </div>
          )}
        </div>
        {/* Drag-over layer: eases in; colors don't animate, the layer fades */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: over ? 1 : 0 }}
          transition={reduce ? spring.fade : spring.soft}
          className="pointer-events-none flex items-center justify-center rounded-lg border border-text bg-primary-tint [grid-area:1/1]"
        >
          <span className="text-body font-semibold">Drop to add</span>
        </motion.div>
      </section>
    </motion.li>
  )
}

/** Status pill: text + icon. "Added" draws its check in when it changes after the card first appears. */
export function StatusPill({ pill, placeholder = false }: { pill: Pill; /** Holds the space, invisible and hidden from screen readers */ placeholder?: boolean }) {
  const reduce = useReducedMotionConfig() ?? false
  const p = PILLS[pill]
  // Only draw the check when the card becomes "Added" while on screen, not on load
  const [startedAs] = useState(pill)
  return (
    <span aria-hidden={placeholder || undefined} className={`flex min-h-6 shrink-0 items-center gap-1 self-start rounded-full px-2 text-small font-semibold ${p.cls} ${placeholder ? 'invisible' : ''}`}>
      <motion.span
        key={pill}
        className="flex"
        initial={pill === 'added' && startedAs !== 'added' ? (reduce ? { opacity: 0 } : { clipPath: 'inset(0 100% 0 0)' }) : false}
        animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0% 0 0)' }}
        transition={spring.quick}
      >
        <p.Icon size={16} weight="regular" aria-hidden />
      </motion.span>
      {p.text}
    </span>
  )
}

/** The designer's illustration: decorative (empty alt), lazy loaded; box 80px on phone, 96px from 600px, contain. */
function Illustration({ art }: { art: Art }) {
  return <img src={art.src} srcSet={art.srcSet} sizes={art.sizes} alt="" width={96} height={96} loading="lazy" decoding="async" className="size-20 shrink-0 object-contain tablet:size-24" />
}
