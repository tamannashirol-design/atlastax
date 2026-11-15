import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { QuestionLayout } from '../components/QuestionLayout'
import { SecondaryButton } from '../components/SecondaryButton'
import { UploadAnswer } from '../components/UploadAnswer'
import { DebugStack, useUrlFlag } from '../lib/debug'
import { navigate, useHistoryState } from '../lib/router'
import { setAnswers, setDetail, useAnswers, useFilingYear } from './answers'
import { PREVIOUS_RETURN } from '../documents.config'
import { isOutOfScope } from '../residency/fromAnswers'
import { UnsupportedSheet } from '../residency/UnsupportedSheet'
import { sectionIndex } from './sections'
import { AFTER_FLOW, flow, pathForSection, positionOf } from './screens'

// One page for the whole question flow. Because it stays mounted while the
// address changes, the shell and stepper stay put and animate between screens.
export default function FlowPage({ path }: { path: string }) {
  const answers = useAnswers()
  const year = useFilingYear()
  const historyState = useHistoryState()
  // Back/Continue skip screens that don't apply to these answers (income follow-ups, residency steps)
  const applies = (i: number) => !flow[i].when || flow[i].when!(answers, year)
  const requested = flow.findIndex((s) => s.path === path)
  // A sheet screen (income uploads) opens over the page before it: render that page, sheet on top
  const host = flow[requested].sheet
    ? (flow
        .slice(0, requested)
        .map((_, i) => i)
        .filter((i) => !flow[i].sheet && applies(i))
        .pop() ?? requested)
    : requested
  const index = host
  const screen = flow[index]
  const sheetScreen = flow[requested].sheet ? flow[requested] : null
  const before = flow.slice(0, index).map((_, i) => i).filter(applies).pop()
  const nextAfter = (from: number) => {
    const i = flow.map((_, j) => j).find((j) => j > from && applies(j))
    return i !== undefined ? flow[i].path : AFTER_FLOW
  }
  const back = before !== undefined ? flow[before].path : '/'
  const next = nextAfter(index)
  // After the last question, the Documents page opens "from the flow" (it then shows Continue).
  // Opening an upload sheet remembers its page, so closing it can simply go back.
  // From one sheet to the next, the history entry is replaced (Back never reopens a finished sheet).
  const isSheet = (to: string) => !!flow.find((s) => s.path === to)?.sheet
  const go = (to: string, fromSheet = false) =>
    navigate(to, to === AFTER_FLOW ? { fromFlow: true } : isSheet(to) ? { sheetFrom: screen.path } : null, { replace: fromSheet })
  const goNext = () => go(next)
  const closeSheet = () => {
    if (historyState.sheetFrom === screen.path) window.history.back()
    else navigate(screen.path, null, { replace: true })
  }
  // A sheet that closes because we moved on to another page: focus that page's question
  const sheetOnPage = useRef<string | null>(null)
  useEffect(() => {
    if (sheetScreen) sheetOnPage.current = screen.path
  }, [sheetScreen, screen.path])
  const afterSheetExit = () => {
    if (sheetScreen) return // one sheet replaced another: nothing to do
    const moved = sheetOnPage.current && sheetOnPage.current !== screen.path
    sheetOnPage.current = null
    // Next frame: the sheet (a modal) is still in the page during this callback, so the page behind can't take focus yet
    if (moved) requestAnimationFrame(() => document.getElementById(questionId)?.focus({ preventScroll: true }))
  }
  const [sheet, setSheet] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  // Saved where the Documents page reads it, so a return added here shows "Added" there (and the other way round)
  const priorSaved = answers.details?.[PREVIOUS_RETURN.uploadScreen]
  const priorFiles: string[] = Array.isArray(priorSaved) ? priorSaved : typeof answers.priorReturn === 'object' ? [answers.priorReturn.fileName] : []
  const setPriorFiles = (files: string[]) => setDetail(PREVIOUS_RETURN.uploadScreen, files)
  const firstRender = useRef(true)
  const [grid] = useUrlFlag('grid')
  const [outlines] = useUrlFlag('outlines')
  const questionId = `q-${screen.id}`
  const question = typeof screen.question === 'function' ? screen.question(answers, year) : screen.question

  // New screen: update the tab title, scroll to top, and move focus to the
  // question so screen-reader users hear where they are.
  useEffect(() => {
    document.title = `${question} · AtlasTax`
    document.querySelector('main')?.scrollTo(0, 0)
    // First screen after a page load: leave focus alone, unless nothing has
    // focus (e.g. arriving from Home or the intro, whose button just went away)
    const nothingFocused = !document.activeElement || document.activeElement === document.body
    if (firstRender.current && !nothingFocused) firstRender.current = false
    else {
      firstRender.current = false
      document.getElementById(questionId)?.focus({ preventScroll: true })
    }
  }, [question, questionId])

  // Filed before → Yes: ask for the previous return first.
  // J-1 but not a student: a neutral "We don't support this yet" (students only for now; no calculation).
  // Otherwise: carry on. (No automatic routing on residency results.)
  const onContinue = () =>
    screen.stop
      ? navigate(screen.stop.href)
      : screen.id === 'filed-before' && answers.filedBefore === 'yes'
      ? setSheet(true)
      : screen.id === 'j1-student' && answers.residency?.j1Student === 'no'
        ? setUnsupported(true)
        : goNext()

  const finishSheet = (priorReturn: 'skipped' | { fileName: string }) => {
    setAnswers({ priorReturn })
    setSheet(false)
    goNext()
  }

  return (
    <DebugStack grid={grid} outlines={outlines}>
      <QuestionLayout
        year={year}
        position={positionOf(screen, answers, year)}
        backHref={back}
        questionId={questionId}
        question={question}
        helper={screen.helper}
        continueLabel={screen.stop?.label}
        lastSection={isOutOfScope(answers, year) ? sectionIndex('time') : undefined}
        help={
          // A stop screen: a quiet "Save and exit" under its button
          screen.stop
            ? { label: 'Save and exit', icon: false, onClick: () => navigate('/') }
            : // The skip link hides once the question is answered (it would discard the upload)
              screen.skip && !screen.isAnswered(answers, year)
            ? { label: screen.skip.label, icon: false, onClick: () => (setDetail(screen.id, screen.skip!.value), goNext()) }
            : screen.helpLabel
              ? { label: screen.helpLabel }
              : undefined
        }
        canContinue={screen.isAnswered(answers, year)}
        onContinue={onContinue}
        onNavigate={(section) => {
          const target = pathForSection(section, answers, year)
          navigate(target.path, target.state)
        }}
        answers={screen.answers(answers, questionId, year)}
        answerArea={screen.answerArea}
        wide={screen.wide}
      />

      <AnimatePresence>{unsupported && <UnsupportedSheet onClose={() => setUnsupported(false)} />}</AnimatePresence>

      {/* Income uploads: one sheet at a time; the next upload replaces it (mode "wait") */}
      <AnimatePresence mode="wait" onExitComplete={afterSheetExit}>
        {sheetScreen && (
          <BottomSheet
            key={sheetScreen.id}
            title={typeof sheetScreen.question === 'function' ? sheetScreen.question(answers, year) : sheetScreen.question}
            onClose={closeSheet}
          >
            {sheetScreen.helper && <p className="text-body text-text-muted">{sheetScreen.helper}</p>}
            <div className="pt-6">{sheetScreen.answers(answers, `q-${sheetScreen.id}`, year)}</div>
            <div className="flex flex-col gap-2 pt-8">
              <PrimaryButton disabled={!sheetScreen.isAnswered(answers, year)} onClick={() => go(nextAfter(requested), true)}>
                Continue
              </PrimaryButton>
              {sheetScreen.skip && !sheetScreen.isAnswered(answers, year) && (
                <SecondaryButton onClick={() => (setDetail(sheetScreen.id, sheetScreen.skip!.value), go(nextAfter(requested), true))}>{sheetScreen.skip.label}</SecondaryButton>
              )}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <BottomSheet title="To continue, we’ll ask for your previous tax return." onClose={() => setSheet(false)}>
            <p className="text-body text-text-muted">This is optional, but uploading it will save you time and reduce errors.</p>
            {/* Same upload control as every upload question (zone + file list) */}
            <div className="pt-6">
              <UploadAnswer docLabel="previous return" uploaded={priorFiles} upload={{ key: PREVIOUS_RETURN.uploadScreen, itemId: PREVIOUS_RETURN.id }} onUploaded={(name) => setPriorFiles([name])} onRemove={() => setPriorFiles([])} />
            </div>
            <div className="flex flex-col gap-2 pt-8">
              <PrimaryButton disabled={!priorFiles.length} onClick={() => finishSheet({ fileName: priorFiles[0] })}>
                Continue
              </PrimaryButton>
              <SecondaryButton onClick={() => finishSheet('skipped')}>Skip for now</SecondaryButton>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </DebugStack>
  )
}
