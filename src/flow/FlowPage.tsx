import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { QuestionLayout } from '../components/QuestionLayout'
import { SecondaryButton } from '../components/SecondaryButton'
import { UploadAnswer } from '../components/UploadAnswer'
import { DebugStack, useUrlFlag } from '../lib/debug'
import { navigate } from '../lib/router'
import { setAnswers, setDetail, useAnswers, useFilingYear } from './answers'
import { UnsupportedSheet } from '../residency/UnsupportedSheet'
import { AFTER_FLOW, flow, pathForSection, positionOf } from './screens'

// One page for the whole question flow. Because it stays mounted while the
// address changes, the shell and stepper stay put and animate between screens.
export default function FlowPage({ path }: { path: string }) {
  const answers = useAnswers()
  const index = flow.findIndex((s) => s.path === path)
  const screen = flow[index]
  const year = useFilingYear()
  // Back/Continue skip screens that don't apply to these answers (income follow-ups, residency steps)
  const applies = (i: number) => !flow[i].when || flow[i].when!(answers, year)
  const before = flow.slice(0, index).map((_, i) => i).filter(applies).pop()
  const after = flow.map((_, i) => i).find((i) => i > index && applies(i))
  const back = before !== undefined ? flow[before].path : '/'
  const next = after !== undefined ? flow[after].path : AFTER_FLOW
  // After the last question, the Documents page opens "from the flow" (it then shows Continue)
  const goNext = () => navigate(next, next === AFTER_FLOW ? { fromFlow: true } : null)
  const [sheet, setSheet] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [priorFiles, setPriorFiles] = useState<string[]>(() => (typeof answers.priorReturn === 'object' ? [answers.priorReturn.fileName] : []))
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
    screen.id === 'filed-before' && answers.filedBefore === 'yes'
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
        help={
          // The skip link hides once the question is answered (it would discard the upload)
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

      <AnimatePresence>
        {sheet && (
          <BottomSheet title="To continue, we’ll ask for your previous tax return." onClose={() => setSheet(false)}>
            <p className="text-body text-text-muted">This is optional, but uploading it will save you time and reduce errors.</p>
            {/* Same upload control as every upload question (zone + file list) */}
            <div className="pt-6">
              <UploadAnswer docLabel="previous return" uploaded={priorFiles} onUploaded={(name) => setPriorFiles([name])} onRemove={() => setPriorFiles([])} />
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
