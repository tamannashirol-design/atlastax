import { useRef, type KeyboardEvent } from 'react'
import { AnswerTile } from './AnswerTile'

// A single-choice group of 2 or 3 answer tiles (behaves like radio buttons).
// Fills the fixed answer area. Gap = grid gutter, so with 3 tiles on iPad and
// laptop each tile spans exactly 2 grid columns (2 tiles span 3 each).
// Keyboard: Tab into the group, arrow keys move and select.

export type TileOption<T extends string> = { value: T; code: string; description?: string; codeHidden?: boolean }

type Props<T extends string> = { labelledBy: string; options: TileOption<T>[]; value?: T; onChange: (v: T) => void }

export function TileGroup<T extends string>({ labelledBy, options, value, onChange }: Props<T>) {
  const tiles = useRef<(HTMLButtonElement | null)[]>([])
  const focusable = Math.max(0, options.findIndex((o) => o.value === value))

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    onChange(options[next].value)
    tiles.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid flex-1 gap-(--grid-gutter)"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o, i) => (
        <AnswerTile
          key={o.value}
          ref={(el) => {
            tiles.current[i] = el
          }}
          code={o.code}
          description={o.description}
          codeHidden={o.codeHidden}
          selected={value === o.value}
          onSelect={() => onChange(o.value)}
          tabIndex={i === focusable ? 0 : -1}
          onKeyDown={onKeyDown(i)}
        />
      ))}
    </div>
  )
}
