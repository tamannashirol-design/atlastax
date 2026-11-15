import { WarningCircleIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { PrimaryButton } from '../components/PrimaryButton'
import { QuestionLayout } from '../components/QuestionLayout'
import { DocumentUploadSheet } from '../documents/DocumentUploadSheet'
import { READING_SCENARIOS, retryReading, setMockScenario, startReading, useExtraction } from '../extraction/client'
import { useAnswers, useFilingYear } from '../flow/answers'
import { requiredItems, type DocumentItem } from '../flow/requiredDocuments'
import { AFTER_FLOW, REVIEW_PATH, pathForSection } from '../flow/screens'
import { at } from '../flow/sections'
import { spring } from '../lib/motion'
import { navigate } from '../lib/router'
import { ReadingPill } from './ReadingPill'
import { announcements, continueLabel, DONE_HOLD_MS, failureCopy, readingOverview, readingStage, rowsSignature, stageLabel, type ReadingRow, type ReadingStage } from './logic'

// The Reading page (/reading): Documents → Continue always lands here (prototype).
// Opening it asks the server to read every document from the beginning; the mock
// takes 3–5s per stage. One pill, three labels, in order, each changed only by the
// server's events (rules in ./logic.ts):
//   Reading your documents → Extracting your details → Done
// When "Done" has settled: hold DONE_HOLD_MS, then on to Review (replace).
// A failure: the pill stops at "Couldn't read N documents" and each failed document
// shows "Try again" (or "Choose another file") and "Enter it myself"; Continue waits
// for the person. Optional documents are read and never block.
// Live region: each stage once, and each document that couldn't be read.
// Dev: ?reading=normal|fail|allfail|wrongtype|blurry|rotated sets the mock for this visit.

const QUESTION_ID = 'q-reading'
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export default function ReadingPage() {
  const answers = useAnswers()
  const year = useFilingYear()
  const extraction = useExtraction()
  const reduce = useReducedMotionConfig() ?? false
  const items = requiredItems(answers)

  // Start reading once per visit. Until the server confirms, nothing earlier counts.
  const [started, setStarted] = useState<'no' | 'yes' | 'failed'>('no')
  const [attempt, setAttempt] = useState(0)
  // Dev switch, read once (before it's dropped from the address)
  const [scenario] = useState(() => (import.meta.env.DEV ? READING_SCENARIOS[new URLSearchParams(window.location.search).get('reading') ?? ''] : undefined))
  useEffect(() => {
    let live = true
    if (scenario) {
      // Drop the switch from the address so it doesn't follow on to Review
      const u = new URL(window.location.href)
      u.searchParams.delete('reading')
      window.history.replaceState(window.history.state, '', u)
    }
    void (async () => {
      try {
        if (scenario) await setMockScenario(scenario)
        await startReading(year)
        if (live) setStarted('yes')
      } catch {
        if (live) setStarted('failed')
      }
    })()
    return () => {
      live = false
    }
  }, [year, attempt, scenario])

  const ov = readingOverview(items, extraction)
  const stage: ReadingStage = started === 'yes' ? (readingStage(ov) ?? 'reading') : started === 'failed' ? 'failed' : 'reading'
  const label = started === 'failed' ? 'Couldn’t start reading' : stageLabel(stage, ov)
  const sig = rowsSignature(ov.rows)

  // Nothing to read: back to Documents
  useEffect(() => {
    if (started === 'yes' && ov.outcome === 'empty') navigate(AFTER_FLOW, { fromFlow: true }, { replace: true })
  }, [started, ov.outcome])

  // Done has settled: hold, then on to Review
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (stage !== 'done') return setSettled(false)
    if (!settled) return
    const t = setTimeout(() => navigate(REVIEW_PATH, null, { replace: true }), DONE_HOLD_MS)
    return () => clearTimeout(t)
  }, [stage, settled])

  // The live region: real changes only, several queued one after another
  const [announce, setAnnounce] = useState('')
  const prev = useRef<{ stage: ReadingStage | null; rows: ReadingRow[] } | null>(null)
  const queue = useRef<string[]>([])
  const pumping = useRef(false)
  useEffect(() => {
    if (started !== 'yes') return
    const next = { stage, rows: ov.rows }
    const messages = announcements(prev.current, next)
    prev.current = next
    if (!messages.length) return
    queue.current.push(...messages)
    if (pumping.current) return
    pumping.current = true
    const pump = () => {
      const m = queue.current.shift()
      if (m === undefined) return void (pumping.current = false)
      setAnnounce(m)
      setTimeout(pump, 1200)
    }
    setTimeout(pump, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig stands for ov.rows
  }, [started, stage, sig])

  // Focus: the headline when the page shows (like every question screen)
  useEffect(() => {
    document.getElementById(QUESTION_ID)?.focus({ preventScroll: true })
    document.title = 'Reading your documents · AtlasTax'
  }, [])

  // "Choose another file": the same upload sheet as the Documents page
  const [replacing, setReplacing] = useState<DocumentItem | null>(null)
  const afterSheet = useRef<() => void>(() => {})
  const focusRow = (id: string) => document.getElementById(`reading-row-${id}`)?.focus({ preventScroll: true })
  // A new file was chosen (its earlier reading was dropped by the upload): read it now
  const latest = useRef(extraction)
  latest.current = extraction
  const closeReplace = () => {
    const id = replacing?.id
    setReplacing(null)
    if (id && !latest.current.documents[id]) void retryReading(year, id)
  }
  const itemFor = (id: string) => items.find((i): i is DocumentItem => i.kind === 'document' && i.id === id)

  const needsContinue = started === 'yes' && (ov.outcome === 'needs-continue' || ov.outcome === 'all-failed')
  const failedRows = started === 'yes' ? ov.rows.filter((r) => r.status === 'failed') : []
  const failedIds = failedRows.filter((r) => !r.optional).map((r) => r.id)

  return (
    <>
      <QuestionLayout
        year={year}
        position={at('review')}
        backHref={AFTER_FLOW}
        backState={{ fromFlow: true }}
        questionId={QUESTION_ID}
        // TODO confirm copy: the heading stays put while the pill says what's happening
        question="Your documents"
        helper="You’ll check everything before it’s used."
        answerArea="auto"
        answers={
          <div className="flex flex-col gap-6">
            <ReadingPill stage={stage} label={label} reduce={reduce} onSettled={() => setSettled(true)} />
            {started === 'failed' && (
              <button
                type="button"
                onClick={() => {
                  setStarted('no')
                  setAttempt((n) => n + 1)
                }}
                className={`flex h-11 items-center self-start rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold active:bg-sage-100 ${focusRing}`}
              >
                Try again
              </button>
            )}
            <AnimatePresence initial={false}>
              {failedRows.length > 0 && (
                <motion.ul
                  aria-label="Documents we couldn’t read"
                  className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-strong bg-surface"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: spring.fade }}
                  transition={reduce ? spring.fade : spring.soft}
                >
                  {failedRows.map((row) => (
                    <FailedRow
                      key={row.id}
                      row={row}
                      onRetry={() => {
                        void retryReading(year, row.id)
                        document.getElementById(QUESTION_ID)?.focus({ preventScroll: true })
                      }}
                      onReplace={() => {
                        const item = itemFor(row.id)
                        if (!item) return
                        afterSheet.current = () => focusRow(row.id)
                        setReplacing(item)
                      }}
                      onEnter={() => navigate(REVIEW_PATH, { enter: [row.id] })}
                    />
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        }
        canContinue={needsContinue}
        footer={
          needsContinue ? (
            // Something failed: wait for the person. Review lists the failed ones as "Enter it myself".
            <PrimaryButton onClick={() => navigate(REVIEW_PATH, { enter: failedIds })}>{continueLabel(ov)}</PrimaryButton>
          ) : null
        }
        onNavigate={(section) => {
          const target = pathForSection(section, answers, year)
          navigate(target.path, target.state)
        }}
      />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <AnimatePresence onExitComplete={() => afterSheet.current()}>
        {replacing && <DocumentUploadSheet item={replacing} onClose={closeReplace} />}
      </AnimatePresence>
    </>
  )
}

function FailedRow({ row, onRetry, onReplace, onEnter }: { row: ReadingRow; onRetry: () => void; onReplace: () => void; onEnter: () => void }) {
  const copy = failureCopy(row)
  return (
    <li id={`reading-row-${row.id}`} tabIndex={-1} className={`flex flex-col gap-3 rounded-md px-4 pb-4 focus-visible:-outline-offset-2 ${focusRing}`}>
      {/* 56pt row: name left, "Couldn't read" (icon + text) right */}
      <div className="flex min-h-14 items-center justify-between gap-4">
        <span className="min-w-0 text-body font-semibold [overflow-wrap:anywhere]">
          {row.name.replace(/(\S)-(?=\S)/g, '$1⁠-⁠')}
          {row.optional && <span className="font-normal text-text-muted"> · Optional</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-small font-semibold text-error">
          <WarningCircleIcon size={24} weight="regular" aria-hidden />
          Couldn’t read
        </span>
      </div>
      <p className="text-small">{copy.message}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={copy.first === 'retry' ? onRetry : onReplace}
          className={`flex h-11 items-center rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold active:bg-sage-100 ${focusRing}`}
        >
          {copy.first === 'retry' ? 'Try again' : 'Choose another file'}
          <span className="sr-only"> for {row.name}</span>
        </button>
        <button type="button" onClick={onEnter} className={`flex min-h-11 items-center rounded-sm px-1 text-body font-semibold underline underline-offset-4 ${focusRing}`}>
          Enter it myself
          <span className="sr-only"> for {row.name}</span>
        </button>
      </div>
    </li>
  )
}
