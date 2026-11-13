import { CheckIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { matches, type Place } from '../data/places'
import { useAnchoredPopover } from '../lib/popover'

// Searchable dropdown (WAI-ARIA "combobox with list autocomplete"), 56pt tall,
// same on every screen size. Type to filter · ↓/↑ move · Enter selects ·
// Escape closes the list (or clears the text if it's already closed).
// Editing the text after choosing clears the answer until you choose again.

type Props = { labelledBy: string; options: Place[]; value?: string; onChange: (v: string | undefined) => void; placeholder: string }

export function SearchSelect({ labelledBy, options, value, onChange, placeholder }: Props) {
  const id = useId()
  const selected = options.find((o) => o.value === value)
  const [text, setText] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const field = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useAnchoredPopover(open, field, pop, close)

  // While the text equals the chosen country, show the full list; otherwise filter
  // Names that start with the typed text come first ("india" → India before British Indian Ocean Territory)
  const results = useMemo(() => {
    if (selected && text === selected.label) return options
    const q = text.trim().toLowerCase()
    const found = options.filter((o) => matches(o.label, text))
    return [...found.filter((o) => o.label.toLowerCase().startsWith(q)), ...found.filter((o) => !o.label.toLowerCase().startsWith(q))]
  }, [options, selected, text])

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, id])

  const choose = (o: Place) => {
    onChange(o.value)
    setText(o.label)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const last = results.length - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((a) => Math.min(last, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (open) setOpen(false)
      else {
        setText('')
        onChange(undefined)
      }
    }
  }

  return (
    <>
      <div
        ref={field}
        className="flex h-14 w-full items-center gap-3 rounded-sm border border-border-strong bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text"
      >
        <MagnifyingGlassIcon size={24} weight="regular" aria-hidden className="shrink-0 text-text-muted" />
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-labelledby={labelledBy}
          aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
            setOpen(true)
            if (value) onChange(undefined)
          }}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-muted"
        />
      </div>
      <div ref={pop} popover="manual" className="overflow-y-auto rounded-md border border-border-decorative bg-surface py-2 text-text shadow-3">
        <ul id={`${id}-list`} role="listbox" aria-labelledby={labelledBy}>
          {results.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onPointerDown={(e) => e.preventDefault() /* keep focus in the field */}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(o)}
              className={`flex min-h-11 cursor-default items-center justify-between gap-3 px-4 text-body ${i === active ? 'bg-sage-100' : ''}`}
            >
              {o.label}
              {o.value === value && <CheckIcon size={24} weight="regular" aria-hidden className="shrink-0" />}
            </li>
          ))}
        </ul>
        {results.length === 0 && <p className="flex min-h-11 items-center px-4 text-body text-text-muted">No countries match “{text}”</p>}
      </div>
      {/* Screen readers hear how many matches there are */}
      <span className="sr-only" aria-live="polite">
        {open ? `${results.length} ${results.length === 1 ? 'country' : 'countries'}` : ''}
      </span>
    </>
  )
}
