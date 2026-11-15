import { CheckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState } from 'react'
import { AmountField } from '../components/AmountField'
import { revealValue } from './client'
import { fieldNeeds, showsTick, type FieldPatch, type ReviewField } from './logic'

// One detail on a Review screen. A real <label>, a real input, real checkboxes.
//   Wages · Box 1
//   ⚠ Please check                 ← only when the reader wasn't sure (icon + words)
//   [ $ 24180.00            USD ]
//   [✓] This is correct            ← per the tick rule (logic.ts)
//   [ ] Not on my form             ← only for fields that may be blank
// ID numbers: the mask (from the server) with a "Show" button; Show fetches the
// full value, which stays in this row's state until the screen closes. Changes are
// saved as you type (after a short pause) and when you leave the field. Editing
// a value clears its tick, here at once and on the server.

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'
const box = 'flex h-14 w-full items-center gap-2 rounded-sm border border-border-strong px-4'

type Props = {
  itemId: string
  f: ReviewField
  manual: boolean
  save: (key: string, patch: FieldPatch) => Promise<boolean>
  /** The page calls these before Confirm, so a pending edit is never lost */
  registerFlush: (key: string, flush: (() => Promise<void>) | null) => void
  say: (message: string) => void
}

export function FieldRow({ itemId, f, manual, save, registerFlush, say }: Props) {
  const labelId = useId()
  const inputId = useId()
  const noteId = useId()
  const showId = useId()
  // Sensitive: hidden until Show, unless there's nothing to hide (then it's typed)
  const [revealed, setRevealed] = useState(!f.sensitive || !f.hasValue)
  const [text, setText] = useState(f.sensitive ? '' : f.shown)
  const [dirty, setDirty] = useState(false)
  const latest = useRef({ text, dirty })
  latest.current = { text, dirty }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Follow the server's value while not editing (e.g. after a reload)
  useEffect(() => {
    if (!f.sensitive && !latest.current.dirty) setText(f.shown)
  }, [f.shown, f.sensitive])

  const flush = async () => {
    clearTimeout(timer.current)
    if (!latest.current.dirty) return
    const value = latest.current.text.trim()
    const ok = await save(f.key, { value })
    if (ok) setDirty(false)
  }
  useEffect(() => {
    registerFlush(f.key, flush)
    return () => registerFlush(f.key, null)
  })

  const change = (v: string) => {
    setText(v)
    setDirty(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 600)
  }

  // While an edit is on its way, show what the server will say: value as typed, no tick
  const view = dirty ? { ...f, hasValue: text.trim().length > 0, ticked: false } : f
  const needs = fieldNeeds(view)
  const missingNote = !view.hasValue && !view.notOnForm ? (manual ? 'Type it from your document.' : 'We couldn’t find this. Type it from your document.') : null
  const low = !manual && f.confidence === 'low' && view.hasValue
  const described = low || missingNote ? noteId : undefined

  const show = async () => {
    const v = await revealValue(itemId, f.key)
    if (v === null) return say(`We couldn’t show your ${f.label.toLowerCase()}. Try again.`)
    setText(v)
    setRevealed(true)
    say(`${f.label} shown`)
    requestAnimationFrame(() => document.getElementById(inputId)?.focus())
  }
  const hide = async () => {
    await flush()
    setText('')
    setRevealed(false)
    say(`${f.label} hidden`)
    requestAnimationFrame(() => document.getElementById(showId)?.focus())
  }

  const input = (() => {
    if (f.sensitive && !revealed)
      return (
        <div className="flex items-center gap-2">
          <div className={`${box} min-w-0 flex-1 bg-sage-100`} aria-labelledby={labelId} role="group">
            <span aria-hidden className="text-body tabular-nums">
              {f.shown}
            </span>
            <span className="sr-only">{f.spoken}</span>
          </div>
          <button id={showId} type="button" onClick={() => void show()} className={`flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 text-body font-semibold underline underline-offset-4 ${focusRing}`}>
            Show<span className="sr-only"> {f.label}</span>
          </button>
        </div>
      )
    if (f.kind === 'money') return <AmountField id={inputId} labelledBy={labelId} describedBy={described} value={text} onChange={change} onBlur={() => void flush()} />
    return (
      <div className="flex items-center gap-2">
        <div className={`${box} min-w-0 flex-1 bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text`}>
          <input
            id={inputId}
            type={f.kind === 'date' ? 'date' : 'text'}
            aria-describedby={described}
            autoComplete="off"
            spellCheck={false}
            inputMode={f.kind === 'id' ? 'text' : undefined}
            value={text}
            onChange={(e) => change(f.kind === 'state' ? e.target.value.toUpperCase().slice(0, 2) : e.target.value)}
            onBlur={() => void flush()}
            className={`h-full min-w-0 flex-1 bg-transparent text-body outline-none ${f.kind === 'id' || f.kind === 'date' ? 'tabular-nums' : ''}`}
          />
        </div>
        {f.sensitive && f.hasValue && (
          <button type="button" onClick={() => void hide()} className={`flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 text-body font-semibold underline underline-offset-4 ${focusRing}`}>
            Hide<span className="sr-only"> {f.label}</span>
          </button>
        )}
      </div>
    )
  })()

  return (
    <li className="flex flex-col gap-2 py-4" data-needs={needs ?? 'done'}>
      <div className="flex items-baseline justify-between gap-4">
        <label id={labelId} htmlFor={f.sensitive && !revealed ? undefined : inputId} className="text-body font-semibold">
          {f.label}
        </label>
        {f.box && <span className="shrink-0 text-small text-text-muted">{f.box}</span>}
      </div>
      {low && (
        <p id={noteId} className="flex items-center gap-2 text-small font-semibold">
          <WarningCircleIcon size={24} weight="regular" aria-hidden />
          Please check
        </p>
      )}
      {!low && missingNote && (
        <p id={noteId} className="text-small text-text-muted">
          {missingNote}
        </p>
      )}
      {!view.notOnForm && input}
      {showsTick(view) && <Checkbox label="This is correct" field={f.label} checked={view.ticked} onChange={(c) => void (async () => {
        await flush()
        await save(f.key, { ticked: c })
      })()} />}
      {f.mayBeBlank && (!view.hasValue || view.notOnForm) && (
        <Checkbox label="Not on my form" field={f.label} checked={view.notOnForm} onChange={(c) => void save(f.key, { notOnForm: c })} />
      )}
    </li>
  )
}

/** A 44pt checkbox row: real <input type="checkbox">, drawn with tokens (navy when checked, check in on-primary). */
function Checkbox({ label, field, checked, onChange }: { label: string; field: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start rounded-sm pr-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-text">
      <span className="grid size-6 shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer size-6 appearance-none rounded-xs border border-border-strong bg-surface outline-none [grid-area:1/1] checked:border-text checked:bg-text" />
        <CheckIcon size={24} weight="regular" aria-hidden className="pointer-events-none invisible text-on-primary [grid-area:1/1] peer-checked:visible" />
      </span>
      <span className="text-body">
        {label}
        <span className="sr-only">: {field}</span>
      </span>
    </label>
  )
}
