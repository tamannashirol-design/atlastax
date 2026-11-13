import { QuestionIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { TAX_YEAR } from '../config'
import type { FlowPosition } from '../flow/sections'
import { AppShell } from './AppShell'
import { FlowStepper } from './FlowStepper'
import { PrimaryButton } from './PrimaryButton'

// The layout every question screen uses. One block, same structure everywhere:
//
//   ┌ header (fixed height) ─────────────────────────────┐
//   │ unused space falls here, ABOVE the question, so the │
//   │ helper stays close to the tiles and nothing below   │
//   │ ever moves                                          │
//   │ question (Display, 2 lines reserved)                │
//   │ ── 8 ──                                             │
//   │ helper text (2 lines reserved on phone, 1 above)    │
//   └─────────────────────────────────────────────────────┘
//   ── 40 ──
//   answer area (fixed height: --answer-h)
//   ── 32 ──
//   Continue
//   ── 8 ──
//   help link
//
// Below 1024px: compact stepper directly under the top bar; the block sits
// slightly above the middle of the space between stepper and tab bar.
// 1024px and up: stepper rail (columns 1–3) and question (columns 4–9) form one
// block, top edges aligned, sitting slightly above the middle of the page.
// "Slightly above" = spacers above and below in a 2:3 ratio.

type Props = {
  position: FlowPosition
  /** id of the question heading; answers use it as their aria-labelledby */
  questionId: string
  question: string
  /** Must fit the fixed answer area. */
  answers: ReactNode
  canContinue: boolean
  onContinue?: () => void
  helper?: string
  help?: { label: string; onClick?: () => void }
  onNavigate?: (section: number) => void
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'
// The 6-column question column (all 4 columns on phone)
const column = 'col-span-full tablet:col-span-6 tablet:col-start-2 desktop:col-start-4'

export function QuestionLayout({ position, questionId, question, answers, canContinue, onContinue, helper, help, onNavigate }: Props) {
  return (
    <AppShell title={`${TAX_YEAR} tax return`} backHref="/" activeTab="home">
      <div className="flex flex-1 flex-col page-x">
        {/* Phone + iPad portrait: compact stepper, directly under the top bar */}
        <div className="page-content page-grid desktop:hidden">
          <div className="col-span-full flex h-(--stepper-h) items-center tablet:col-span-6 tablet:col-start-2">
            <FlowStepper presentation="compact" position={position} onNavigate={onNavigate} />
          </div>
        </div>

        {/* Top spacer: 2 parts */}
        <div className="min-h-6 flex-[2]" />

        {/* Rows: 1 = filler (only the unused part of the reserved header height),
            2 = question + helper, 3 = answers, 4 = Continue + link. */}
        <div className="page-content page-grid grid-rows-[1fr_auto_auto_auto]">
          {/* Invisible reserve: header height = 80 (2 question lines) + 8 + helper
              (40 phone / 20 at 600px+). It spans rows 1–2, so row 1 takes only the
              space the question and helper don't use: the extra lands above them. */}
          <div aria-hidden className={`pointer-events-none row-span-2 row-start-1 min-h-32 tablet:min-h-27 ${column}`} />

          {/* Laptop + iPad landscape: rail starts at row 2 → level with the question text */}
          <div className="hidden self-start desktop:col-span-3 desktop:col-start-1 desktop:row-span-3 desktop:row-start-2 desktop:block">
            <FlowStepper presentation="rail" position={position} onNavigate={onNavigate} />
          </div>

          <div className={`row-start-2 flex flex-col gap-2 ${column}`}>
            <h1 id={questionId} className="font-display text-display">
              {question}
            </h1>
            {helper && <p className="text-small text-text-muted">{helper}</p>}
          </div>

          <div className={`row-start-3 mt-10 flex h-(--answer-h) flex-col ${column}`}>{answers}</div>

          <div className={`row-start-4 mt-8 flex flex-col gap-2 ${column}`}>
            <PrimaryButton disabled={!canContinue} onClick={onContinue}>
              Continue
            </PrimaryButton>
            {help && (
              <button
                type="button"
                onClick={help.onClick}
                className={`flex min-h-11 items-center gap-2 self-start rounded-sm text-body font-semibold underline underline-offset-4 ${focusRing}`}
              >
                <QuestionIcon size={24} weight="regular" aria-hidden />
                {help.label}
              </button>
            )}
          </div>
        </div>

        {/* Bottom spacer: 3 parts */}
        <div className="min-h-6 flex-[3]" />
      </div>
    </AppShell>
  )
}
