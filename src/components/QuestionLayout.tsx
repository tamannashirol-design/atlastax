import { QuestionIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { FlowPosition } from '../flow/sections'
import { Link } from '../lib/router'
import { AppShell } from './AppShell'
import { FlowStepper } from './FlowStepper'
import { PrimaryButton } from './PrimaryButton'

// The layout every question screen uses. One block, same structure everywhere:
//
//   ┌ header (fixed height) ─────────────────────────────┐
//   │ unused space falls here, ABOVE the question, so the │
//   │ helper stays close to the tiles and nothing below   │
//   │ ever moves                                          │
//   │ question (Display: 3 lines reserved on phone, 2 at  │
//   │ 600px+; the longest questions need 3 on a phone)    │
//   │ ── 8 ──                                             │
//   │ helper text (2 lines reserved on phone, 1 above)    │
//   └─────────────────────────────────────────────────────┘
//   ── 40 ──
//   answer area (fixed height: --answer-h)
//   ── 32 ──
//   Continue
//   ── 8 ──
//   help link (2 lines reserved, so long links never shift the block)
//
// Below 1024px: compact stepper directly under the top bar; the block sits
// slightly above the middle of the space between stepper and tab bar.
// 1024px and up: stepper rail (columns 1–3) and question (columns 4–9) form one
// block, top edges aligned, sitting slightly above the middle of the page.
// "Slightly above" = spacers above and below in a 2:3 ratio.

type Props = {
  /** The tax year being filed (top bar title) */
  year: number
  position: FlowPosition
  /** Where the back arrow goes (the previous question, or Home) */
  backHref: string
  /** id of the question heading; answers use it as their aria-labelledby */
  questionId: string
  question: string
  /** Must fit the fixed answer area, unless answerArea is "auto". */
  answers: ReactNode
  /** "auto": grows with its content (card grids, lists). Uploads open in a sheet instead (FlowPage). */
  answerArea?: 'fixed' | 'auto'
  /** Card grids only: at 1024px+ the question and answers span 8 columns
   *  (cols 4–11) instead of 6, so a 4th card fits at the same size. Continue
   *  keeps the normal 6-column width, so it never moves between screens. */
  wide?: boolean
  canContinue: boolean
  onContinue?: () => void
  /** The primary button's label (default "Continue"; the stop screen says "Check my answers") */
  continueLabel?: string
  /** Stepper shows sections only up to this one (outside the v1 scope) */
  lastSection?: number
  helper?: string
  /** Link under Continue. icon: false for action links like "I'll add it later". */
  help?: { label: string; onClick?: () => void; icon?: boolean }
  onNavigate?: (section: number) => void
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'
// The 6-column question column (all 4 columns on phone)
const column = 'col-span-full tablet:col-span-6 tablet:col-start-2 desktop:col-start-4'
const wideColumn = `${column} desktop:col-span-8`
// Keep hyphenated words (W-2, 1099-NEC, on-campus) on one line: an invisible
// word joiner on each side of the hyphen stops the browser breaking there.
const keepHyphensTogether = (text: string) => text.replace(/(\S)-(?=\S)/g, '$1\u2060-\u2060')

export function QuestionLayout({ year, position, backHref, questionId, question, answers, answerArea = 'fixed', wide = false, canContinue, onContinue, continueLabel = 'Continue', lastSection, helper, help, onNavigate }: Props) {
  const block = wide ? wideColumn : column
  return (
    <AppShell
      title={`${year} tax return`}
      backHref={backHref}
      activeTab="home"
      // Answers save as you go, so leaving is always safe
      action={
        <Link href="/" className="flex min-h-11 items-center rounded-sm text-small font-semibold whitespace-nowrap underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
          Save and exit
        </Link>
      }
    >
      <div className="flex flex-1 flex-col page-x">
        {/* Phone + iPad portrait: compact stepper, directly under the top bar */}
        <div className="page-content page-grid desktop:hidden">
          <div className="col-span-full flex h-(--stepper-h) items-center tablet:col-span-6 tablet:col-start-2">
            <FlowStepper presentation="compact" position={position} onNavigate={onNavigate} lastSection={lastSection} />
          </div>
        </div>

        {/* Top spacer: 2 parts */}
        <div className="min-h-6 flex-[2]" />

        {/* Rows: 1 = filler (only the unused part of the reserved header height),
            2 = question + helper, 3 = answers, 4 = Continue + link. */}
        <div className="page-content page-grid grid-rows-[1fr_auto_auto_auto]">
          {/* Invisible reserve: header height = question lines + 8 + helper lines.
              Phone: 120 + 8 + 40 = 168. 600px+: 80 + 8 + 20 = 108. It spans rows 1–2, so row 1 takes only the
              space the question and helper don't use: the extra lands above them. */}
          <div aria-hidden className={`pointer-events-none row-span-2 row-start-1 min-h-42 tablet:min-h-27 ${column}`} />

          {/* Laptop + iPad landscape: rail starts at row 2 → level with the question text */}
          <div className="hidden self-start desktop:col-span-3 desktop:col-start-1 desktop:row-span-3 desktop:row-start-2 desktop:block">
            <FlowStepper presentation="rail" position={position} onNavigate={onNavigate} lastSection={lastSection} />
          </div>

          <div className={`row-start-2 flex flex-col gap-2 ${block}`}>
            {/* tabIndex -1: receives focus on screen change, for screen readers.
                text-balance: when a question wraps, its lines come out even. */}
            <h1 id={questionId} tabIndex={-1} className="font-display text-display text-balance outline-none">
              {keepHyphensTogether(question)}
            </h1>
            {helper && <p className="text-small text-text-muted">{helper}</p>}
          </div>

          <div className={`row-start-3 mt-10 flex flex-col ${answerArea === 'fixed' ? 'h-(--answer-h)' : ''} ${block}`}>{answers}</div>

          {/* Fixed height = Continue 56 + 8 + link 48, even when there's no link */}
          <div className={`row-start-4 mt-8 flex min-h-28 flex-col gap-2 ${column}`}>
            <PrimaryButton disabled={!canContinue} onClick={onContinue}>
              {continueLabel}
            </PrimaryButton>
            {help && (
              <button
                type="button"
                onClick={help.onClick}
                className={`flex min-h-12 items-center gap-2 self-start rounded-sm text-left text-body font-semibold underline underline-offset-4 ${focusRing}`}
              >
                {help.icon !== false && <QuestionIcon size={24} weight="regular" aria-hidden />}
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
