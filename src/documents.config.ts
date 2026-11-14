// REQUIRED DOCUMENTS: which income needs which tax document.
//
// TODO confirm with CPA: every value in this file is a PLACEHOLDER until a
// tax professional confirms it (forms, conditions, wording).
//
// This is the only place these rules live. Everything else reads them through
// requiredDocuments() (src/flow/requiredDocuments.ts): the flow's upload
// questions (when they appear), the form codes on the income cards, Home's
// Documents summary, the Documents page and the stepper. Don't write a tax
// rule anywhere else.
import type { IncomeId } from './data/income.ts'

export type DocumentRule = {
  /** Stable id, also used in links to the document on the Documents page */
  id: string
  /** The income type that needs it */
  income: IncomeId
  /** Short form name, e.g. "W-2" */
  form: string
  /** What it is, in plain words */
  label: string
  /** Who sends it */
  source: string
  /** The flow screen where it's uploaded; its answer holds the file names, or "later" / "none" */
  uploadScreen: string
  /** Only needed when an earlier answer says so (e.g. "Did you get a 1099-NEC?" → Yes) */
  onlyIf?: { screen: string; answer: string }
  /** Show the form code under the income card's label (only where one form clearly applies) */
  showOnIncomeCard?: boolean
}

// Order = the order of the income cards (and of the flow's follow-ups).
export const DOCUMENT_RULES: DocumentRule[] = [
  {
    id: 'bank-interest-form',
    income: 'bank-interest',
    form: 'Bank interest form',
    label: 'Bank interest form',
    source: 'From your bank, if they sent one',
    uploadScreen: 'bank-upload',
    onlyIf: { screen: 'bank-form', answer: 'yes' },
  },
  { id: 'w2-opt-cpt', income: 'opt-cpt', form: 'W-2', label: 'W-2 for your OPT or CPT job', source: 'From your employer', uploadScreen: 'opt-w2', showOnIncomeCard: true },
  { id: 'w2-on-campus', income: 'on-campus-job', form: 'W-2', label: 'W-2 for your on-campus job', source: 'From your university’s payroll office', uploadScreen: 'campus-w2', showOnIncomeCard: true },
  { id: '1042s-scholarship', income: 'scholarship', form: '1042-S', label: '1042-S for your scholarship', source: 'From your university', uploadScreen: 'scholarship-1042s', showOnIncomeCard: true },
  {
    id: '1099nec-freelance',
    income: 'freelance',
    form: '1099-NEC',
    label: '1099-NEC for freelance work',
    source: 'From your clients',
    uploadScreen: 'freelance-1099',
    onlyIf: { screen: 'freelance-form', answer: 'yes' },
    showOnIncomeCard: true,
  },
  { id: 'investment-forms', income: 'investments', form: '1042-S or 1099-DIV', label: 'Investment tax forms', source: 'From your brokerage or bank', uploadScreen: 'investments-upload' },
  { id: 'brokerage-forms', income: 'trading', form: '1099-B or 1042-S', label: 'Brokerage tax forms', source: 'From your brokerage', uploadScreen: 'trading-upload' },
  {
    id: '1099nec-contract',
    income: 'contract-work',
    form: '1099-NEC',
    label: '1099-NEC for contract work',
    source: 'From your clients',
    uploadScreen: 'contract-1099',
    onlyIf: { screen: 'contract-form', answer: 'yes' },
    showOnIncomeCard: true,
  },
]
