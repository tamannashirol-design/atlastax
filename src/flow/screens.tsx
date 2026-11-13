// Every simple question screen, in flow order. Copy comes from FLOW.md.
// All of them render through the same QuestionLayout (see FlowPage).
import type { ReactNode } from 'react'
import { SearchSelect } from '../components/SearchSelect'
import { SelectField } from '../components/SelectField'
import { TileGroup } from '../components/TileGroup'
import { countries, usStates } from '../data/places'
import { setAnswers, type Answers } from './answers'
import type { FlowPosition } from './sections'

export type FlowScreen = {
  id: string
  path: string
  position: FlowPosition
  question: string
  helper?: string
  helpLabel?: string
  isAnswered: (a: Answers) => boolean
  /** The answer control; must fit the fixed answer area. */
  answers: (a: Answers, labelledBy: string) => ReactNode
}

// Non-breaking hyphens (‑) keep words like "visa‑relevant" on one line.
export const flow: FlowScreen[] = [
  {
    id: 'visa',
    path: '/visa',
    position: { section: 0, step: 0 },
    question: 'What is your visa type?',
    helper: 'To personalize the experience and show only visa‑relevant forms',
    helpLabel: 'Not sure about your visa type?',
    isAnswered: (a) => !!a.visa,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.visa}
        onChange={(visa) => setAnswers({ visa })}
        options={[
          { value: 'F-1', code: 'F-1', description: 'Academic' },
          { value: 'J-1', code: 'J-1', description: 'Exchange' },
          { value: 'M-1', code: 'M-1', description: 'Vocational' },
        ]}
      />
    ),
  },
  {
    id: 'years',
    path: '/years',
    position: { section: 0, step: 1 },
    question: 'How many years have you been on this visa?',
    // FLOW.md wording (wins over the brief, which dropped "- substantial presence")
    helper: 'To determine residency status for correct tax forms ‑ substantial presence',
    helpLabel: 'Calculate how long you have been in the U.S.',
    isAnswered: (a) => !!a.years,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.years}
        onChange={(years) => setAnswers({ years })}
        options={[
          // Exactly 5 years counts as "5 years or more" (flagged for legal review in FLOW.md)
          { value: 'under5', code: '< 5', description: 'Less than 5 years', codeHidden: true },
          { value: '5plus', code: '5+', description: '5 years or more', codeHidden: true },
        ]}
      />
    ),
  },
  {
    id: 'state',
    path: '/state',
    position: { section: 0, step: 2 },
    question: 'What U.S. state do you currently live or study in?',
    helper: 'To identify if a state tax return is required',
    isAnswered: (a) => !!a.state,
    answers: (a, id) => (
      <SelectField labelledBy={id} options={usStates} value={a.state} onChange={(state) => setAnswers({ state })} placeholder="Choose a state" />
    ),
  },
  {
    id: 'tax-id',
    path: '/tax-id',
    position: { section: 1, step: 0 },
    question: 'Do you have a Social Security Number (SSN) or ITIN?',
    helper: 'To decide if you can e‑file or must paper file.',
    helpLabel: 'Not sure whether you have it?',
    isAnswered: (a) => !!a.taxId,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.taxId}
        onChange={(taxId) => setAnswers({ taxId })}
        options={[
          // No descriptions: "Social Security" wraps on a phone and overflows the
          // answer area, and the question already spells out both terms.
          { value: 'ssn', code: 'SSN' },
          { value: 'itin', code: 'ITIN' },
          { value: 'none', code: 'N/A' },
        ]}
      />
    ),
  },
  {
    id: 'filed-before',
    path: '/filed-before',
    position: { section: 1, step: 1 },
    question: 'Have you filed U.S. taxes before?',
    helpLabel: 'Not sure whether you have filed before?',
    isAnswered: (a) => !!a.filedBefore,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.filedBefore}
        onChange={(filedBefore) => setAnswers({ filedBefore })}
        options={[
          { value: 'yes', code: 'Yes' },
          { value: 'no', code: 'No' },
        ]}
      />
    ),
  },
  {
    id: 'citizenship',
    path: '/citizenship',
    position: { section: 1, step: 2 },
    question: 'What is your country of citizenship?',
    helper: 'To automatically check tax‑treaty eligibility',
    helpLabel: 'What is a tax‑treaty?',
    isAnswered: (a) => !!a.citizenship,
    answers: (a, id) => (
      <SearchSelect
        labelledBy={id}
        options={countries()}
        value={a.citizenship}
        onChange={(citizenship) => setAnswers({ citizenship })}
        placeholder="Search countries"
      />
    ),
  },
]

/** Where Continue goes after the last simple question (Income isn't built yet). */
export const AFTER_FLOW = '/income'

export const isFlowPath = (path: string) => flow.some((s) => s.path === path)
