import { CaretDownIcon } from '@phosphor-icons/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// A quiet text button that opens a small menu (WAI-ARIA menu button).
//   ↓ / Enter / Space open it on the first item · ↑ opens on the last
//   ↑ ↓ move · Home / End · Enter / Space choose · Escape or Tab close
//   Focus returns to the button when the menu closes without a choice; after
//   a choice, the caller decides (it may move focus to the card).
// The menu lives in the browser's top layer (popover), placed under the
// button (or above when there's no room), so nothing in the layout floats.

export type MenuItem = { label: string; onSelect: () => void }

type Props = { label: ReactNode; items: MenuItem[]; /** Extra words for screen readers, e.g. "for W-2" */ srLabel?: string }

const GAP = 8

export function MenuButton({ label, items, srLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const id = useId()

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  useLayoutEffect(() => {
    const el = menu.current
    if (!el) return
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    el.showPopover()
    const place = () => {
      const a = button.current?.getBoundingClientRect()
      if (!a) return
      const h = el.offsetHeight
      const up = window.innerHeight - a.bottom < h + GAP * 2 && a.top > h + GAP * 2
      const left = Math.min(a.left, window.innerWidth - el.offsetWidth - GAP * 2)
      Object.assign(el.style, { margin: '0', inset: 'auto', left: `${Math.max(GAP * 2, left)}px`, top: up ? `${a.top - GAP - h}px` : `${a.bottom + GAP}px` })
    }
    place()
    el.querySelectorAll<HTMLElement>('[role=menuitem]')[active]?.focus()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, active])

  // Click outside closes (focus stays where the click went)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!button.current?.contains(t) && !menu.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])

  const openAt = (i: number) => {
    setActive(i)
    setOpen(true)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : openAt(0))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            openAt(0)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            openAt(items.length - 1)
          }
        }}
        className="flex min-h-11 items-center gap-1 rounded-sm px-1 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        {label}
        {srLabel && <span className="sr-only"> {srLabel}</span>}
        <CaretDownIcon size={24} weight="regular" aria-hidden />
      </button>
      <ul
        ref={menu}
        id={id}
        role="menu"
        popover="manual"
        aria-label={typeof label === 'string' ? `${label}${srLabel ? ` ${srLabel}` : ''}` : srLabel}
        onKeyDown={(e) => {
          const n = items.length
          if (e.key === 'ArrowDown') setActive((i) => (i + 1) % n)
          else if (e.key === 'ArrowUp') setActive((i) => (i - 1 + n) % n)
          else if (e.key === 'Home') setActive(0)
          else if (e.key === 'End') setActive(n - 1)
          else if (e.key === 'Escape') close()
          else if (e.key === 'Tab') close(false)
          else return
          if (e.key !== 'Tab') e.preventDefault()
        }}
        className="min-w-56 rounded-md border border-border-decorative bg-surface p-2 text-text shadow-3"
      >
        {items.map((item, i) => (
          <li key={item.label} role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-body hover:bg-sage-100 focus-visible:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-text"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
