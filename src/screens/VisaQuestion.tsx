import { useRef, useState, type KeyboardEvent } from 'react'
import { AnswerTile } from '../components/AnswerTile'
import { QuestionLayout } from '../components/QuestionLayout'
import type { FlowPosition } from '../flow/sections'
import { DebugStack, useUrlFlag } from '../lib/debug'

// Q1 of the filing flow (see FLOW.md §2). Layout comes from QuestionLayout.

const position: FlowPosition = { section: 0, step: 0 }

const options = [
  { code: 'F-1', description: 'Academic' },
  { code: 'J-1', description: 'Exchange' },
  { code: 'M-1', description: 'Vocational' },
]

export default function VisaQuestion() {
  const [visa, setVisa] = useState<string | null>(null)
  const tiles = useRef<(HTMLButtonElement | null)[]>([])
  const [grid] = useUrlFlag('grid')
  const [outlines] = useUrlFlag('outlines')

  // Radio-group keyboard behavior: arrow keys move and select.
  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    setVisa(options[next].code)
    tiles.current[next]?.focus()
  }
  const focusable = Math.max(0, options.findIndex((o) => o.code === visa))

  return (
    <DebugStack grid={grid} outlines={outlines}>
      <QuestionLayout
        position={position}
        questionId="question"
        question="What is your visa type?"
        canContinue={!!visa}
        helper="To personalize the experience and show only visa‑relevant forms"
        help={{ label: 'Not sure about your visa type?' }}
        answers={
          // Gap = grid gutter, so on iPad/laptop each tile spans exactly 2 grid columns.
          // Tiles stretch to the fixed answer-area height.
          <div role="radiogroup" aria-labelledby="question" className="grid flex-1 grid-cols-3 gap-(--grid-gutter)">
            {options.map((o, i) => (
              <AnswerTile
                key={o.code}
                ref={(el) => {
                  tiles.current[i] = el
                }}
                code={o.code}
                description={o.description}
                selected={visa === o.code}
                onSelect={() => setVisa(o.code)}
                tabIndex={i === focusable ? 0 : -1}
                onKeyDown={onKeyDown(i)}
              />
            ))}
          </div>
        }
      />
    </DebugStack>
  )
}
