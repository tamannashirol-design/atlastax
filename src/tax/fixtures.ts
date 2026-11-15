// DEVELOPMENT ONLY. TEST INPUTS for /result (/result?result=refund|owed|blocked|waiting).
// Every number below is a SAMPLE made up to show the screen: it was NOT calculated,
// is NOT from the IRS, and is not your return. The page says so on screen.
// The numbers do add up (check:result tests it), so the breakdown reads sensibly.
import { FORMS_NOT_READY, RESULT_NOTES, type Estimate, type EstimateLine, type Calculated } from './estimate.ts'
import type { ResultFixture } from './fixtureNames.ts'

const SAMPLE = 'Test input'
const line = (id: string, group: EstimateLine['group'], label: string, amount: number, formLine?: string): EstimateLine => ({ id, group, label, amount, formLine, from: SAMPLE })
const SOURCES = [{ table: 'Test input', citation: 'Sample figures, not from an IRS publication' }]

/** cents */
const federal = (payments: number): Calculated => {
  const tax = 377_900 // SAMPLE tax, not computed
  const diff = payments - tax
  return {
    status: diff > 0 ? 'refund' : diff < 0 ? 'owed' : 'zero',
    amount: Math.abs(diff),
    sources: SOURCES,
    lines: [
      line('wages', 'income', 'Wages', 3_845_000, 'Form 1040-NR, line 1a'),
      line('total-income', 'income', 'Total income', 3_845_000),
      line('deduction', 'deductions', 'State income tax (itemized)', 189_300),
      line('taxable', 'deductions', 'Taxable income', 3_655_700),
      line('tax', 'tax', 'Tax', tax),
      line('withheld', 'payments', 'Federal tax withheld', payments),
      line('result', 'result', diff >= 0 ? 'Refund' : 'Amount owed', Math.abs(diff)),
    ],
  }
}
const state = (taxAmount: number): Calculated & { code: string | null } => {
  const withheld = 189_300
  const diff = withheld - taxAmount
  return {
    code: 'NY',
    status: diff > 0 ? 'refund' : diff < 0 ? 'owed' : 'zero',
    amount: Math.abs(diff),
    sources: SOURCES,
    lines: [
      line('state-wages', 'income', 'State wages', 3_845_000),
      line('state-tax', 'tax', 'State tax', taxAmount),
      line('state-withheld', 'payments', 'State tax withheld', withheld),
      line('state-result', 'result', diff >= 0 ? 'Refund' : 'Amount owed', Math.abs(diff)),
    ],
  }
}

const base = { year: 2025, notes: [...RESULT_NOTES], forms: FORMS_NOT_READY, numbersHidden: false }

export const RESULT_SAMPLES: Record<ResultFixture, Estimate> = {
  // federal refund $407, state refund $120
  refund: { ...base, blockers: [], federal: federal(418_600), state: state(177_300) },
  // federal owed $593, state owed $85
  owed: { ...base, blockers: [], federal: federal(318_600), state: state(197_800) },
  // something unconfirmed: what's blocking, with links
  blocked: {
    ...base,
    blockers: [
      { id: 'i94:unconfirmed', reason: 'Most recent I-94: not confirmed yet.', fix: { label: 'Check your I-94', target: { path: '/review', state: { doc: 'i94' } } } },
      { id: 'opt-cpt:wages:unticked', reason: 'W-2: Wages hasn’t been marked correct.', fix: { label: 'Check your W-2', target: { path: '/review', state: { doc: 'opt-cpt' } } } },
    ],
    federal: { status: 'not-calculated', missing: ['Waiting for the items listed above.', 'The federal calculation isn’t built yet.'] },
    state: { code: 'NY', status: 'not-calculated', missing: ['Waiting for the items listed above.', 'The state calculation isn’t built yet.'] },
  },
  // everything confirmed, the engine just isn't built (what you see today)
  waiting: {
    ...base,
    blockers: [],
    federal: { status: 'not-calculated', missing: ['The federal calculation isn’t built yet.'] },
    state: { code: 'NY', status: 'not-calculated', missing: ['The state calculation isn’t built yet.'] },
  },
}
