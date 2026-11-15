import { CheckIcon, CircleDashedIcon, ClockIcon, FileTextIcon, IdentificationCardIcon, MinusCircleIcon } from '@phosphor-icons/react'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { MenuButton, type MenuItem } from '../components/MenuButton'
import { art } from '../data/income'
import { spring } from '../lib/motion'

// One document on the Documents page: a friendly card, not a form row.
//   [art] name · one-line hint (or the file names once added)
//   status pill (text + icon, never color alone)
//   one action: a soft "Add" (primary tint, navy text; never cobalt) or
//   "Replace", plus at most one quiet secondary ("Not now" menu, or Undo)
// The whole card is a drop zone (iPad and laptop): dragging a file over it
// eases in a primary-tint fill with "Drop to add"; dropping opens the upload
// sheet with the file already uploading. Add stays for keyboard and phone.
// White surface, radius lg, faint sage border + soft shadow; 24 padding.

export type Pill = 'todo' | 'added' | 'later' | 'none' | 'optional' | 'details'

const PILLS: Record<Pill, { text: string; Icon: typeof CheckIcon; cls: string }> = {
  todo: { text: 'To do', Icon: CircleDashedIcon, cls: 'bg-sage-100 text-text' },
  added: { text: 'Added', Icon: CheckIcon, cls: 'border border-success bg-surface text-success' },
  later: { text: 'Later', Icon: ClockIcon, cls: 'bg-sage-100 text-text' },
  none: { text: 'Not available', Icon: MinusCircleIcon, cls: 'bg-sage-100 text-text' },
  optional: { text: 'Optional', Icon: CircleDashedIcon, cls: 'bg-sage-100 text-text-muted' },
  details: { text: 'Details needed', Icon: CircleDashedIcon, cls: 'bg-sage-100 text-text' },
}

type Props = {
  id: string
  name: string
  optional?: boolean
  /** One-line hint, or the file names once added */
  hint: string
  artwork: 'passport' | 'id' | 'document'
  pill: Pill
  /** The one action: Add / Replace. Omit for items that can't be added (self-reported income). */
  primary?: { label: string; onClick: () => void }
  /** The quiet secondary: a menu ("Not now") or a single button (Undo, "Remind me later") */
  secondary?: { kind: 'menu'; label: string; items: MenuItem[] } | { kind: 'button'; label: string; onClick: () => void }
  /** Dropping a file on the card */
  onDropFile?: (file: File) => void
  index: number
}

export function DocumentCard({ id, name, optional, hint, artwork, pill, primary, secondary, onDropFile, index }: Props) {
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
          <div className="flex items-start gap-4">
            <Art kind={artwork} />
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 id={`item-${id}-title`} className="text-body font-semibold">
                {name}
                {/* Optional is said by the pill ("Optional") and the hint; screen readers hear it with the name */}
                {optional && <span className="sr-only"> (optional)</span>}
              </h3>
              <p className="text-small text-text-muted [overflow-wrap:anywhere]">{hint}</p>
            </div>
          </div>
          <StatusPill pill={pill} />
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
              {secondary?.kind === 'menu' && <MenuButton label={secondary.label} srLabel={`for ${name}`} items={secondary.items} />}
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
export function StatusPill({ pill }: { pill: Pill }) {
  const reduce = useReducedMotionConfig() ?? false
  const p = PILLS[pill]
  // Only draw the check when the card becomes "Added" while on screen, not on load
  const [startedAs] = useState(pill)
  return (
    <span className={`flex min-h-7 items-center gap-1 self-start rounded-full px-3 text-small font-semibold ${p.cls}`}>
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

function Art({ kind }: { kind: Props['artwork'] }): ReactNode {
  if (kind === 'passport') {
    const a = art('optcpt')
    return <img src={a.src} srcSet={a.srcSet} sizes="48px" alt="" width={48} height={48} loading="lazy" decoding="async" className="size-12 shrink-0 object-contain" />
  }
  const Icon = kind === 'id' ? IdentificationCardIcon : FileTextIcon
  return (
    <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-md bg-sage-100">
      <Icon size={24} weight="regular" />
    </span>
  )
}
