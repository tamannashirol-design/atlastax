import { QuestionIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { TAX_YEAR } from '../config'
import type { FlowPosition } from '../flow/sections'
import { AppShell } from './AppShell'
import { FlowStepper } from './FlowStepper'
import { PrimaryButton } from './PrimaryButton'

// The layout every question screen uses. One block, same structure everywhere:
//
//   question (Display)
//   ── 32 ──
//   answer area (fixed height: --answer-h)
//   ── 32 ──
//   Continue
//   ── 16 ──
//   helper text (space reserved even when empty, so the link never moves)
//   ── 4 ──
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

        <div className="page-content page-grid">
          {/* Laptop + iPad landscape: rail, top edge aligned with the question */}
          <div className="hidden self-start desktop:col-span-3 desktop:col-start-1 desktop:row-start-1 desktop:block">
            <FlowStepper presentation="rail" position={position} onNavigate={onNavigate} />
          </div>

          <div className="col-span-full flex flex-col gap-8 tablet:col-span-6 tablet:col-start-2 desktop:col-start-4 desktop:row-start-1">
            <h1 id={questionId} className="font-display text-display">
              {question}
            </h1>
            <div className="flex h-(--answer-h) flex-col">{answers}</div>
            <div className="flex flex-col gap-4">
              <PrimaryButton disabled={!canContinue} onClick={onContinue}>
                Continue
              </PrimaryButton>
              <div className="flex flex-col gap-1">
                {/* Reserved: 2 lines below 1024px, 1 line above */}
                <p className="min-h-10 text-small text-text-muted desktop:min-h-5">{helper}</p>
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
          </div>
        </div>

        {/* Bottom spacer: 3 parts */}
        <div className="min-h-6 flex-[3]" />
      </div>
    </AppShell>
  )
}
