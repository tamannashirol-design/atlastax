// TAX YEAR 2025: every figure the federal estimate uses, each with its IRS source.
// The ONLY place these numbers live (CLAUDE.md: tax rules never sit in components).
// Everything here was read from the IRS PDFs themselves (not from memory) and is
// marked TODO confirm with CPA until a CPA signs it off.
//
// Sources (printed page numbers are the PDF's own page numbers):
//   RP    = Rev. Proc. 2024-40 (irs.gov/pub/irs-drop/rp-24-40.pdf)
//   I1040 = Instructions for Form 1040 (2025) (irs.gov/pub/irs-prior/i1040gi--2025.pdf)
//   I1040NR = Instructions for Form 1040-NR (2025) (irs.gov/pub/irs-prior/i1040nr--2025.pdf)
//   F1040NR = Form 1040-NR (2025) (irs.gov/pub/irs-prior/f1040nr--2025.pdf)
//
// Money in this file is whole DOLLARS unless a name ends in `Cents`.
import type { Source } from '../estimate.ts'
import { STATES_2025, type StatesConfig } from './states-2025.ts'

export const TODO_CPA = 'TODO confirm with CPA'

/** One row of the single-filer tax rate table (RP Table 3) */
export type Bracket = {
  /** Taxable income over this (dollars) */
  over: number
  /** …but not over this (dollars); null = no limit */
  upTo: number | null
  /** The "plus" amount printed by the IRS (cents) */
  baseCents: number
  /** The rate, in whole percent */
  ratePercent: number
}

export const SINGLE_BRACKETS: readonly Bracket[] = [
  { over: 0, upTo: 11_925, baseCents: 0, ratePercent: 10 },
  { over: 11_925, upTo: 48_475, baseCents: 119_250, ratePercent: 12 },
  { over: 48_475, upTo: 103_350, baseCents: 557_850, ratePercent: 22 },
  { over: 103_350, upTo: 197_300, baseCents: 1_765_100, ratePercent: 24 },
  { over: 197_300, upTo: 250_525, baseCents: 4_019_900, ratePercent: 32 },
  { over: 250_525, upTo: 626_350, baseCents: 5_723_100, ratePercent: 35 },
  { over: 626_350, upTo: null, baseCents: 18_876_975, ratePercent: 37 },
]

/**
 * The Tax Table (taxable income under $100,000). It is printed as rows; the IRS figures each row
 * as the tax on the row's MIDDLE amount, rounded to whole dollars. The rows get wider as income
 * grows. `npm run check:tax` proves this rule reproduces all 2,062 printed rows.
 */
export const TAX_TABLE = {
  /** Below this the Tax Table is used; at or above it, the Tax Computation Worksheet */
  worksheetFrom: 100_000,
  /** Row widths (dollars): the first rows are 0–5, 5–15, 15–25; then $25 steps up to 3,000; then $50 steps */
  firstRows: [5, 15, 25] as readonly number[],
  stepsOf25Until: 3_000,
  step25: 25,
  step50: 50,
}

/** Tax Computation Worksheet, Section A (single), for taxable income of $100,000 or more */
export type WorksheetRow = {
  over: number
  upTo: number | null
  /** column (b): the multiplication amount, in whole percent */
  ratePercent: number
  /** column (d): the subtraction amount (cents) */
  subtractCents: number
}
export const WORKSHEET_SINGLE: readonly WorksheetRow[] = [
  { over: 100_000, upTo: 103_350, ratePercent: 22, subtractCents: 508_600 },
  { over: 103_350, upTo: 197_300, ratePercent: 24, subtractCents: 715_300 },
  { over: 197_300, upTo: 250_525, ratePercent: 32, subtractCents: 2_293_700 },
  { over: 250_525, upTo: 626_350, ratePercent: 35, subtractCents: 3_045_275 },
  { over: 626_350, upTo: null, ratePercent: 37, subtractCents: 4_297_975 },
]

/** Where each figure comes from. The estimate lists these under "Figures used". */
export const SOURCES = {
  wages: { table: 'Wages', citation: 'Form 1040-NR (2025), line 1a: Form W-2, box 1. Instructions for Form 1040-NR (2025), page 17.' },
  rounding: { table: 'Rounding', citation: 'Instructions for Form 1040 (2025), “Rounding Off to Whole Dollars”, page 23 (50 to 99 cents rounds up; cents are added first, only the total is rounded).' },
  deductions: { table: 'Deductions', citation: 'Form 1040-NR (2025), line 12. Not included yet: itemized deductions (Schedule A) and the India student standard deduction come in a later step.' },
  taxTable: { table: 'Tax Table', citation: 'Instructions for Form 1040 (2025), 2025 Tax Table, pages 68–79, Single column (the column the Instructions for Form 1040-NR (2025), page 24, send single filers to).' },
  worksheet: { table: 'Tax Computation Worksheet', citation: 'Instructions for Form 1040 (2025), 2025 Tax Computation Worksheet—Line 16, page 80, Section A (Single).' },
  brackets: { table: 'Tax rates', citation: 'Rev. Proc. 2024-40, section 2.01, Table 3 (unmarried individuals), page 6.' },
  lineChoice: { table: 'Which method', citation: 'Instructions for Form 1040 (2025), Line 16, page 36: under $100,000 use the Tax Table, $100,000 or more the Tax Computation Worksheet.' },
  withheld: { table: 'Federal tax withheld', citation: 'Form 1040-NR (2025), line 25a: Form W-2, box 2. Instructions for Form 1040-NR (2025), page 22.' },
  refundOwed: { table: 'Refund or amount owed', citation: 'Form 1040-NR (2025), lines 33 and 24 (refund = line 34, amount owed = line 37). Instructions for Form 1040-NR (2025), page 23.' },
} satisfies Record<string, Source>

/** The config the engine reads for a year */
export type YearConfig = {
  year: number
  /** 'final': IRS forms for this year are final · 'draft': not yet, no estimate */
  status: 'final' | 'draft'
  brackets: readonly Bracket[]
  taxTable: typeof TAX_TABLE
  worksheet: readonly WorksheetRow[]
  sources: typeof SOURCES
  /** The state estimates (New York, California) and the states with no tax on wages */
  states: StatesConfig
  review: typeof TODO_CPA
}

export const YEAR_2025: YearConfig = {
  year: 2025,
  status: 'final',
  brackets: SINGLE_BRACKETS,
  taxTable: TAX_TABLE,
  worksheet: WORKSHEET_SINGLE,
  sources: SOURCES,
  states: STATES_2025,
  review: TODO_CPA,
}
