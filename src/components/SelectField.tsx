import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Place } from '../data/places'
import { useAnchoredPopover } from '../lib/popover'

// A single-choice dropdown, 56pt tall.
//   Phone (below 600px): the phone's own picker (native <select>), the most
//   familiar and accessible option on touch.
//   iPad + laptop: a custom list (WAI-ARIA "select-only combobox"):
//     ↓/↑ open and move · Home/End · type letters to jump · Enter selects ·
//     Escape closes · click outside closes.

type Props = { labelledBy: string; options: Place[]; value?: string; onChange: (v: string) => void; placeholder: string }

export const fieldClass =
  'flex h-14 w-full items-center gap-3 rounded-sm border border-border-strong bg-surface px-4 text-left text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export function SelectField(props: Props) {
  return (
    <>
      <div className="flex tablet:hidden">
        <NativeSelect {...props} />
      </div>
      <div className="hidden tablet:flex tablet:flex-1">
        <ListboxSelect {...props} />
      </div>
    </>
  )
}

function NativeSelect({ labelledBy, options, value, onChange, placeholder }: Props) {
  return (
    // Select and caret share one grid cell (no absolute positioning)
    <div className="grid w-full">
      <select
        aria-labelledby={labelledBy}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} appearance-none pr-12 [grid-area:1/1] ${value ? '' : 'text-text-muted'}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDownIcon size={24} weight="regular" aria-hidden className="pointer-events-none mr-4 self-center justify-self-end [grid-area:1/1]" />
    </div>
  )
}

function ListboxSelect({ labelledBy, options, value, onChange, placeholder }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const selectedIndex = options.findIndex((o) => o.value === value)
  const [active, setActive] = useState(Math.max(0, selectedIndex))
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', time: 0 })
  const close = useCallback(() => setOpen(false), [])
  useAnchoredPopover(open, button, list, close)

  // Keep the active option in view
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, id])

  const openAt = (i: number) => {
    setActive(i)
    setOpen(true)
  }
  const choose = (i: number) => {
    onChange(options[i].value)
    setOpen(false)
  }
  const typeAhead = (ch: string) => {
    const now = Date.now()
    typed.current.text = now - typed.current.time > 600 ? ch : typed.current.text + ch
    typed.current.time = now
    const q = typed.current.text.toLowerCase()
    const i = options.findIndex((o) => o.label.toLowerCase().startsWith(q))
    if (i >= 0) openAt(i)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1
    const keys: Record<string, () => void> = open
      ? {
          ArrowDown: () => setActive((a) => Math.min(last, a + 1)),
          ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
          Home: () => setActive(0),
          End: () => setActive(last),
          PageDown: () => setActive((a) => Math.min(last, a + 10)),
          PageUp: () => setActive((a) => Math.max(0, a - 10)),
          Enter: () => choose(active),
          ' ': () => choose(active),
          Escape: () => setOpen(false),
          Tab: () => setOpen(false),
        }
      : {
          ArrowDown: () => openAt(Math.max(0, selectedIndex)),
          ArrowUp: () => openAt(Math.max(0, selectedIndex)),
          Enter: () => openAt(Math.max(0, selectedIndex)),
          ' ': () => openAt(Math.max(0, selectedIndex)),
        }
    // A space while typing a name ("new y…") is part of the search, not "select"
    if (e.key === ' ' && Date.now() - typed.current.time < 600) {
      e.preventDefault()
      typeAhead(' ')
    } else if (keys[e.key]) {
      if (e.key !== 'Tab') e.preventDefault()
      keys[e.key]()
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      typeAhead(e.key)
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openAt(Math.max(0, selectedIndex)))}
        onKeyDown={onKeyDown}
        className={fieldClass}
      >
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-text-muted'}`}>
          {selectedIndex >= 0 ? options[selectedIndex].label : placeholder}
        </span>
        <CaretDownIcon size={24} weight="regular" aria-hidden className="shrink-0" />
      </button>
      <ul
        ref={list}
        id={`${id}-list`}
        role="listbox"
        aria-labelledby={labelledBy}
        popover="manual"
        tabIndex={-1}
        className="overflow-y-auto rounded-md border border-border-decorative bg-surface py-2 text-text shadow-3"
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === selectedIndex}
            onPointerDown={(e) => e.preventDefault() /* keep focus on the field */}
            onPointerMove={() => setActive(i)}
            onClick={() => choose(i)}
            className={`flex min-h-11 cursor-default items-center justify-between gap-3 px-4 text-body ${i === active ? 'bg-sage-100' : ''}`}
          >
            {o.label}
            {i === selectedIndex && <CheckIcon size={24} weight="regular" aria-hidden className="shrink-0" />}
          </li>
        ))}
      </ul>
    </>
  )
}
