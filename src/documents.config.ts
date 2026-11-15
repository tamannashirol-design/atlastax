// REQUIRED DOCUMENTS: which income needs which tax document.
//
// TODO confirm with CPA: every value in this file is a PLACEHOLDER until a
// tax professional confirms it (forms, conditions, wording). Open questions:
//   - Contract work should match freelance? Both are 1099-NEC, but only
//     freelance is reportableWithoutForm (kept as is for now).
//   - "Or" documents (investments, trading) are one item: any uploaded file
//     counts, whichever of the forms it is.
//   - What to collect for self-reported items (SELF_REPORTED_DETAILS).
//
// This is the only place these rules live. Everything else reads them through
// requiredDocuments() (src/flow/requiredDocuments.ts): the flow's upload
// questions (when they appear), the form codes on the income cards, Home's
// Documents summary, the Documents page and the stepper. Don't write a tax
// rule anywhere else.
import type { IncomeId } from './data/income.ts'

export type DocumentRule = {
  /** Stable id, also used in links to the item on the Documents page */
  id: string
  /** The income type. Picking its card registers the income, whatever the form answer. */
  income: IncomeId
  /** Short form name, e.g. "W-2" */
  form: string
  /** The document, in plain words */
  label: string
  /** The income, in plain words (used for self-reported items) */
  incomeLabel: string
  /** Who sends the form */
  source: string
  /** The flow screen where the form is uploaded; its answer holds the file names, or "later" / "none" */
  uploadScreen: string
  /** The "Did you get a form?" question, if the flow asks one (its answer: "yes" / "no") */
  formQuestion?: string
  /**
   * TODO confirm with CPA. true: if they say they didn't get a form, the
   * income is still registered, as a self-reported item that needs details
   * (no document). false: a form is always expected.
   * Components never decide this; they read requiredItems().
   */
  reportableWithoutForm: boolean
  /** Show the form code under the income card's label (only where one form clearly applies) */
  showOnIncomeCard?: boolean
}

// Order = the order of the income cards (and of the flow's follow-ups).
export const DOCUMENT_RULES: DocumentRule[] = [
  {
    id: 'bank-interest',
    income: 'bank-interest',
    form: '1099-INT',
    label: '1099-INT for bank interest',
    incomeLabel: 'Bank interest',
    source: 'From your bank',
    uploadScreen: 'bank-upload',
    formQuestion: 'bank-form',
    reportableWithoutForm: true,
  },
  { id: 'opt-cpt', income: 'opt-cpt', form: 'W-2', label: 'W-2 from your employer', incomeLabel: 'OPT or CPT job', source: 'From your employer', uploadScreen: 'opt-w2', reportableWithoutForm: false, showOnIncomeCard: true },
  { id: 'on-campus-job', income: 'on-campus-job', form: 'W-2', label: 'W-2 for your on-campus job', incomeLabel: 'On-campus job', source: 'From your university’s payroll office', uploadScreen: 'campus-w2', reportableWithoutForm: false, showOnIncomeCard: true },
  { id: 'scholarship', income: 'scholarship', form: '1042-S', label: '1042-S for your scholarship', incomeLabel: 'Scholarship or fellowship', source: 'From your university', uploadScreen: 'scholarship-1042s', reportableWithoutForm: false, showOnIncomeCard: true },
  {
    id: 'freelance',
    income: 'freelance',
    form: '1099-NEC',
    label: '1099-NEC for freelance work',
    incomeLabel: 'Freelance income',
    source: 'From your clients',
    uploadScreen: 'freelance-1099',
    formQuestion: 'freelance-form',
    reportableWithoutForm: true,
    showOnIncomeCard: true,
  },
  { id: 'investments', income: 'investments', form: '1042-S or 1099-DIV', label: 'Investment tax forms', incomeLabel: 'Investments', source: 'From your brokerage or bank', uploadScreen: 'investments-upload', reportableWithoutForm: false },
  { id: 'trading', income: 'trading', form: '1099-B or 1042-S', label: 'Brokerage tax forms', incomeLabel: 'Trading', source: 'From your brokerage', uploadScreen: 'trading-upload', reportableWithoutForm: false },
  {
    id: 'contract-work',
    income: 'contract-work',
    form: '1099-NEC',
    label: '1099-NEC for contract work',
    incomeLabel: 'Contract work income',
    source: 'From your clients',
    uploadScreen: 'contract-1099',
    formQuestion: 'contract-form',
    reportableWithoutForm: false,
    showOnIncomeCard: true,
  },
]

/**
 * Identity documents: for everyone with a supported status (not tied to
 * income). optional: shown, but not counted in "x of y documents added" and
 * never holds anything up. TODO confirm with CPA.
 */
export type IdentityRule = { id: string; form: string; label: string; source: string; uploadScreen: string; optional?: boolean }

export const IDENTITY_DOCUMENTS: IdentityRule[] = [
  { id: 'passport', form: 'Passport', label: 'Your passport', source: 'The page with your photo', uploadScreen: 'passport-upload' },
  // Separate from the CBP travel history (which is only used to count days)
  { id: 'i94', form: 'Most recent I-94', label: 'Your most recent I-94', source: 'From the CBP I-94 website', uploadScreen: 'i94-upload' },
  { id: 'state-id', form: 'Driver’s license or state ID', label: 'Your driver’s license or state ID', source: 'If you have one', uploadScreen: 'state-id-upload', optional: true },
]

/** Shown above self-reported items on the Documents page. Neutral: no tax advice, amounts or thresholds. */
export const SELF_REPORTED_INTRO = 'You told us you had this income. We’ll ask for the details here.'

/** What to collect for a self-reported item. TODO confirm with CPA: nothing is collected until confirmed. */
export const SELF_REPORTED_DETAILS: string[] = []
