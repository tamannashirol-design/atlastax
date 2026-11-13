import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { QuestionLayout } from '../components/QuestionLayout'
import { SecondaryButton } from '../components/SecondaryButton'
import { DebugStack, useUrlFlag } from '../lib/debug'
import { navigate } from '../lib/router'
import { setAnswers, useAnswers } from './answers'
import { AFTER_FLOW, flow } from './screens'

// One page for the whole question flow. Because it stays mounted while the
// address changes, the shell and stepper stay put and animate between screens.
export default function FlowPage({ path }: { path: string }) {
  const answers = useAnswers()
  const index = flow.findIndex((s) => s.path === path)
  const screen = flow[index]
  const back = index > 0 ? flow[index - 1].path : '/'
  const next = index < flow.length - 1 ? flow[index + 1].path : AFTER_FLOW
  const [sheet, setSheet] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const firstRender = useRef(true)
  const [grid] = useUrlFlag('grid')
  const [outlines] = useUrlFlag('outlines')
  const questionId = `q-${screen.id}`

  // New screen: update the tab title, scroll to top, and move focus to the
  // question so screen-reader users hear where they are.
  useEffect(() => {
    document.title = `${screen.question} · AtlasTax`
    document.querySelector('main')?.scrollTo(0, 0)
    if (firstRender.current) firstRender.current = false
    else document.getElementById(questionId)?.focus({ preventScroll: true })
  }, [screen.question, questionId])

  // Filed before → Yes: ask for the previous return first. No: carry on.
  const onContinue = () => (screen.id === 'filed-before' && answers.filedBefore === 'yes' ? setSheet(true) : navigate(next))

  const finishSheet = (priorReturn: 'skipped' | { fileName: string }) => {
    setAnswers({ priorReturn })
    setSheet(false)
    navigate(next)
  }

  return (
    <DebugStack grid={grid} outlines={outlines}>
      <QuestionLayout
        position={screen.position}
        backHref={back}
        questionId={questionId}
        question={screen.question}
        helper={screen.helper}
        help={screen.helpLabel ? { label: screen.helpLabel } : undefined}
        canContinue={screen.isAnswered(answers)}
        onContinue={onContinue}
        onNavigate={(section) => navigate(flow.find((s) => s.position.section === section)!.path)}
        answers={screen.answers(answers, questionId)}
      />

      <AnimatePresence>
        {sheet && (
          <BottomSheet title="To continue, we’ll ask for your previous tax return." onClose={() => setSheet(false)}>
            <p className="text-body text-text-muted">This is optional, but uploading it will save you time and reduce errors.</p>
            <div className="flex flex-col gap-2 pt-6">
              <PrimaryButton onClick={() => fileInput.current?.click()}>Upload file</PrimaryButton>
              <SecondaryButton onClick={() => finishSheet('skipped')}>Skip for now</SecondaryButton>
            </div>
            {/* Placeholder: the file is only remembered by name for now */}
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) finishSheet({ fileName: file.name })
              }}
            />
          </BottomSheet>
        )}
      </AnimatePresence>
    </DebugStack>
  )
}
