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
import { ResidentSheet } from './ResidentSheet'
import { AFTER_FLOW, flow } from './screens'

// One page for the whole question flow. Because it stays mounted while the
// address changes, the shell and stepper stay put and animate between screens.
export default function FlowPage({ path }: { path: string }) {
  const answers = useAnswers()
  const index = flow.findIndex((s) => s.path === path)
  const screen = flow[index]
  // Back/Continue skip screens that don't apply to these answers (income follow-ups)
  const applies = (i: number) => !flow[i].when || flow[i].when!(answers)
  const before = flow.slice(0, index).map((_, i) => i).filter(applies).pop()
  const after = flow.map((_, i) => i).find((i) => i > index && applies(i))
  const back = before !== undefined ? flow[before].path : '/'
  const next = after !== undefined ? flow[after].path : AFTER_FLOW
  const [sheet, setSheet] = useState(false)
  const [residentSheet, setResidentSheet] = useState(false)
  const [priorFiles, setPriorFiles] = useState<string[]>(() => (typeof answers.priorReturn === 'object' ? [answers.priorReturn.fileName] : []))
  const firstRender = useRef(true)
  const [grid] = useUrlFlag('grid')
  const [outlines] = useUrlFlag('outlines')
  const questionId = `q-${screen.id}`
  const year = useFilingYear()
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
  // 5 years or more → likely a resident (Form 1040), which we don't file: explain and offer other ways.
  // Otherwise: carry on.
  const onContinue = () =>
    screen.id === 'filed-before' && answers.filedBefore === 'yes'
      ? setSheet(true)
      : screen.id === 'years' && answers.years === '5plus'
        ? setResidentSheet(true)
        : navigate(next)

  const finishSheet = (priorReturn: 'skipped' | { fileName: string }) => {
    setAnswers({ priorReturn })
    setSheet(false)
    navigate(next)
  }

  return (
    <DebugStack grid={grid} outlines={outlines}>
      <QuestionLayout
        year={year}
        position={screen.position}
        backHref={back}
        questionId={questionId}
        question={question}
        helper={screen.helper}
        help={
          // The skip link hides once the question is answered (it would discard the upload)
          screen.skipLabel && !screen.isAnswered(answers)
            ? { label: screen.skipLabel, icon: false, onClick: () => (setDetail(screen.id, 'later'), navigate(next)) }
            : screen.helpLabel
              ? { label: screen.helpLabel }
              : undefined
        }
        canContinue={screen.isAnswered(answers)}
        onContinue={onContinue}
        onNavigate={(section) => navigate(flow.find((s) => s.position.section === section)!.path)}
        answers={screen.answers(answers, questionId)}
        answerArea={screen.answerArea}
        wide={screen.wide}
      />

      <AnimatePresence>{residentSheet && <ResidentSheet onClose={() => setResidentSheet(false)} />}</AnimatePresence>

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
