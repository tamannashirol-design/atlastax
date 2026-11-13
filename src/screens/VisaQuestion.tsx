import { CaretLeftIcon, QuestionIcon } from '@phosphor-icons/react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { AnswerTile } from '../components/AnswerTile'
import { PrimaryButton } from '../components/PrimaryButton'
import { StepProgress } from '../components/StepProgress'
import { DebugStack, useUrlFlag } from '../lib/debug'

const options = [
  { code: 'F-1', description: 'Academic' },
  { code: 'J-1', description: 'Exchange' },
  { code: 'M-1', description: 'Vocational' },
]

// Q1 of the filing flow (see FLOW.md §2).
// Layout: centered column (full width on phone, max 560 on iPad/laptop).
// Top: back + progress. Middle: question + tiles. Bottom (pinned): helper,
// help link, Continue. The tab bar is hidden: this is a focused task.
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
      <div className="flex flex-1 flex-col pt-[env(safe-area-inset-top)] page-x">
        <div className="mx-auto flex w-full max-w-column flex-1 flex-col">
          <header className="flex h-14 items-center gap-4">
            <a
              href="/"
              aria-label="Back"
              className="flex size-11 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            >
              <CaretLeftIcon size={24} weight="regular" aria-hidden />
            </a>
            <StepProgress step={1} total={7} />
          </header>

          <main className="flex flex-col gap-8 pt-8 tablet:pt-16">
            <h1 id="question" className="font-display text-display">
              What is your visa type?
            </h1>
            <div role="radiogroup" aria-labelledby="question" className="grid grid-cols-3 gap-3">
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
          </main>

          {/* Spacer pushes the footer to the bottom of the screen */}
          <div className="flex-1" />

          <footer className="sticky bottom-0 flex flex-col gap-4 bg-background pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] tablet:pb-8">
            <div className="flex flex-col gap-1">
              <p className="text-small text-text-muted">
                To personalize the experience and show only visa‑relevant forms
              </p>
              {/* Will open a bottom sheet explaining visa types (next steps) */}
              <button
                type="button"
                className="flex min-h-11 items-center gap-2 self-start rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                <QuestionIcon size={24} weight="regular" aria-hidden />
                Not sure about your visa type?
              </button>
            </div>
            <PrimaryButton disabled={!visa}>Continue</PrimaryButton>
          </footer>
        </div>
      </div>
    </DebugStack>
  )
}
