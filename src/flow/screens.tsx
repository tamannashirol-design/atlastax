// Every simple question screen, in flow order. Copy comes from FLOW.md.
// All of them render through the same QuestionLayout (see FlowPage).
import type { ReactNode } from 'react'
import { AmountField, parseAmount } from '../components/AmountField'
import { IncomePicker } from '../components/IncomePicker'
import { SearchSelect } from '../components/SearchSelect'
import { SelectField } from '../components/SelectField'
import { TileGroup, type TileOption } from '../components/TileGroup'
import { UploadAnswer } from '../components/UploadAnswer'
import { TAX_YEAR } from '../config'
import type { IncomeId } from '../data/income'
import { countries, usStates } from '../data/places'
import { setAnswers, setDetail, type Answers } from './answers'
import type { FlowPosition } from './sections'

export type FlowScreen = {
  id: string
  path: string
  position: FlowPosition
  question: string
  helper?: string
  helpLabel?: string
  isAnswered: (a: Answers) => boolean
  /** Show this screen only when this returns true (income follow-ups). */
  when?: (a: Answers) => boolean
  /** Link under Continue that skips the question, e.g. "I'll add it later". */
  skipLabel?: string
  /** The answer control; must fit the fixed answer area unless answerArea is "auto". */
  answers: (a: Answers, labelledBy: string) => ReactNode
  answerArea?: 'fixed' | 'auto' | 'upload'
  /** Card grid: 8 columns wide at 1024px+ (see QuestionLayout). */
  wide?: boolean
}

// ---------- Income follow-ups (proposal in FLOW.md, approved) ----------
// One question per screen, in income-card order. Screens appear only for the
// income types selected, and branch on earlier answers. Items marked
// "(tax review)" in FLOW.md are intentionally not built yet.

const INCOME: FlowPosition = { section: 2, step: 0 } // Income has no "x of n"
type When = (a: Answers) => boolean
const has = (id: IncomeId): When => (a) => !!a.income?.includes(id)
const answered = (screen: string, v: string): When => (a) => a.details?.[screen] === v
const and = (...w: When[]): When => (a) => w.every((f) => f(a))
const detail = (a: Answers, id: string) => a.details?.[id]

function tiles(id: string, question: string, options: TileOption<string>[], when: When, more: Partial<FlowScreen> = {}): FlowScreen {
  return {
    id,
    path: `/income/${id}`,
    position: INCOME,
    question,
    when,
    isAnswered: (a) => typeof detail(a, id) === 'string',
    answers: (a, labelledBy) => (
      <TileGroup labelledBy={labelledBy} value={detail(a, id) as string | undefined} onChange={(v) => setDetail(id, v)} options={options} />
    ),
    ...more,
  }
}

// Every upload question uses the same control (folder UploadZone + real upload)
// and the same taller answer area, so Continue sits in one place on all of them.
function upload(id: string, docLabel: string, question: string, helper: string, skipLabel: string, when: When): FlowScreen {
  return {
    id,
    path: `/income/${id}`,
    position: INCOME,
    question,
    helper,
    skipLabel,
    when,
    answerArea: 'upload',
    isAnswered: (a) => Array.isArray(detail(a, id)) && (detail(a, id) as string[]).length > 0,
    answers: (a) => {
      const v = detail(a, id)
      const files = Array.isArray(v) ? v : []
      return <UploadAnswer key={id} docLabel={docLabel} uploaded={files} allowAnother onUploaded={(name) => setDetail(id, [...files, name])} />
    },
  }
}

function amount(id: string, question: string, helper: string, when: When): FlowScreen {
  return {
    id,
    path: `/income/${id}`,
    position: INCOME,
    question,
    helper,
    when,
    isAnswered: (a) => parseAmount(detail(a, id) as string | undefined) > 0,
    answers: (a, labelledBy) => (
      <AmountField labelledBy={labelledBy} value={(detail(a, id) as string | undefined) ?? ''} onChange={(v) => setDetail(id, v)} />
    ),
  }
}

const yesNo: TileOption<string>[] = [
  { value: 'yes', code: 'Yes' },
  { value: 'no', code: 'No' },
]
const LATER = "I'll add it later"

function incomeFollowUps(): FlowScreen[] {
  // Freelance and contract work ask the same things
  const selfEmployed = (key: 'freelance' | 'contract-work', name: string, short: string) => [
    tiles(`${short}-form`, `Did you get a 1099-NEC for your ${name}?`, yesNo, has(key), { helper: 'If you did, we’ll read the amounts from it' }),
    upload(`${short}-1099`, '1099-NEC', `Upload your 1099-NEC forms for ${name}`, 'From your clients. One per client', LATER, and(has(key), answered(`${short}-form`, 'yes'))),
    amount(`${short}-amount`, `How much were you paid for ${name} in ${TAX_YEAR}?`, 'Add up what every client paid you', and(has(key), answered(`${short}-form`, 'no'))),
  ]
  return [
    // Bank interest
    tiles('bank-form', 'Did you get a tax form for your bank interest?', yesNo, has('bank-interest'), { helper: 'If you did, we’ll read the amounts from it' }),
    upload('bank-upload', 'bank form', 'Upload your bank interest form', 'From your bank, if they sent one', LATER, and(has('bank-interest'), answered('bank-form', 'yes'))),
    amount('bank-amount', `How much bank interest did you earn in ${TAX_YEAR}?`, 'Check your bank statements for the year', and(has('bank-interest'), answered('bank-form', 'no'))),
    // OPT or CPT
    tiles(
      'opt-type',
      'Was this work OPT, CPT, or both?',
      [
        { value: 'opt', code: 'OPT' },
        { value: 'cpt', code: 'CPT' },
        { value: 'both', code: 'Both' },
      ],
      has('opt-cpt'),
      { helper: 'So we can label your job correctly' },
    ),
    upload('opt-w2', 'W-2', 'Upload your W-2 from your OPT or CPT job', 'From your employer. One per employer', LATER, has('opt-cpt')),
    // On-campus job
    upload('campus-w2', 'W-2', 'Upload your W-2 from your on-campus job', 'From your university’s payroll office. One per job', LATER, has('on-campus-job')),
    // Scholarship (the "costs other than tuition" question waits for tax review)
    tiles('scholarship-withheld', 'Did your university withhold tax from your scholarship?', yesNo, has('scholarship'), {
      helper: 'To check refund eligibility',
      helpLabel: 'Not sure whether tax was withheld?',
    }),
    upload('scholarship-1042s', '1042-S', 'Upload your 1042-S for your scholarship', 'From your university', 'I didn’t get one', has('scholarship')),
    // Freelance (expenses wait for tax review)
    ...selfEmployed('freelance', 'freelance work', 'freelance'),
    // Investments
    upload('investments-upload', 'tax form', 'Upload your investment tax forms', 'From your brokerage or bank, such as a 1042-S or 1099-DIV', 'I didn’t get a form', has('investments')),
    // Trading
    upload('trading-upload', 'tax form', 'Upload your brokerage tax forms', 'Such as a 1099-B or 1042-S', 'I didn’t get a form', has('trading')),
    // Contract work (expenses wait for tax review)
    ...selfEmployed('contract-work', 'contract work', 'contract'),
    // No earnings: nothing to ask. Donation and Child care: on hold for tax review.
  ]
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
  {
    id: 'income',
    path: '/income',
    position: { section: 2, step: 0 },
    question: 'Select the ones that apply to you',
    isAnswered: (a) => (a.income?.length ?? 0) > 0,
    answerArea: 'auto',
    wide: true,
    answers: (a, id) => <IncomePicker labelledBy={id} value={a.income ?? []} onChange={(income) => setAnswers({ income })} />,
  },
  ...incomeFollowUps(),
]

/** Where Continue goes after the last question (Documents isn't built yet). */
export const AFTER_FLOW = '/documents'

export const isFlowPath = (path: string) => flow.some((s) => s.path === path)
