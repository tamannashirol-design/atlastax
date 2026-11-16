// TAX YEAR 2025, STATES: every figure the state estimates use, each with its official source.
// The ONLY place these numbers live (CLAUDE.md: tax rules never sit in components). All of it was
// read from the states' own documents (not from memory) and is marked TODO confirm with CPA.
//
// Sources (page numbers are the PDF's own pages):
//   IT-201-I = Instructions for Form IT-201 (2025), New York State Department of Taxation and Finance
//              https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf
//   IT-203-I = Instructions for Form IT-203 (2025), https://www.tax.ny.gov/pdf/current_forms/it/it203i.pdf
//   IT-201   = Form IT-201 (2025), https://www.tax.ny.gov/pdf/current_forms/it/it201_fill_in.pdf
//   NY table = 2025 New York State Tax Table, https://www.tax.ny.gov/pit/file/tax-tables/it201i-2025.htm
//   CA 540   = 2025 Personal Income Tax Booklet (Form 540), Franchise Tax Board
//              https://www.ftb.ca.gov/forms/2025/2025-540-booklet.pdf
//   CA 540NR = 2025 Form 540NR booklet, https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.pdf
//
// WHAT THESE ESTIMATES ASSUME (shown on /result): wages only, filing single, not claimed as anyone's
// dependent, and ALL wages earned in the state of the W-2. For that case the resident and the
// nonresident forms give the same tax: New York's income percentage is 100% (IT-203-I page 21) and
// California's tax rate applies to 100% of the income (540NR booklet, page 14, lines 36 and 38).
// Not included: city taxes (New York City, Yonkers), other credits (e.g. California's renter's
// credit), itemized deductions, other income, State Disability Insurance.
//
// Money is whole DOLLARS unless a name ends in `Cents`; rates are in basis points (1% = 100).
import type { Source } from '../estimate.ts'

export const TODO_CPA = 'TODO confirm with CPA'

/** One row of a state's single-filer rate schedule */
export type StateBracket = {
  /** Taxable income over this (dollars) */
  over: number
  /** …but not over this (dollars); null = no limit */
  upTo: number | null
  /** The "plus" amount printed by the state (cents) */
  baseCents: number
  /** The rate, in basis points (4.5% = 450) */
  rateBps: number
}

export type NyConfig = {
  code: 'NY'
  name: 'New York'
  /** Standard deduction, single, not a dependent (item C "No") */
  standardDeduction: number
  /** "Single and married filing separately" rate schedule */
  brackets: readonly StateBracket[]
  /** Tax Table: used when New York taxable income is under this; the rate schedule from it up */
  tableBelow: number
  /** Tax Table rows: [0,13), [13,25), [25,50), then $50 steps */
  tableFirstRows: readonly number[]
  tableStep: number
  /** Household credit table 1 (Single): federal AGI over `over`, not over `upTo` → credit (dollars) */
  householdCredit: readonly { upTo: number | null; credit: number }[]
  /** Above this New York AGI the recapture worksheets apply (not built yet): no number */
  agiLimit: number
  sources: Record<string, Source>
}

export type CaConfig = {
  code: 'CA'
  name: 'California'
  /** Standard deduction, filing status 1 (single) */
  standardDeduction: number
  /** Personal exemption credit, one per person */
  exemptionCredit: number
  /** Schedule X (single) */
  brackets: readonly StateBracket[]
  /** Tax Table is used up to and including this taxable income; Schedule X above it */
  tableUpTo: number
  /** Tax Table rows: $1–50, then $100 steps ($51–150, $151–250 …), the last row $99,951–100,000 */
  tableFirstHi: number
  tableStep: number
  tableLastLo: number
  /** Above this federal AGI the exemption credit is limited (not built yet): no number */
  agiLimit: number
  sources: Record<string, Source>
}

const dollars = (n: number) => n * 100

export const NEW_YORK: NyConfig = {
  code: 'NY',
  name: 'New York',
  standardDeduction: 8_000,
  brackets: [
    { over: 0, upTo: 8_500, baseCents: 0, rateBps: 400 },
    { over: 8_500, upTo: 11_700, baseCents: dollars(340), rateBps: 450 },
    { over: 11_700, upTo: 13_900, baseCents: dollars(484), rateBps: 525 },
    { over: 13_900, upTo: 80_650, baseCents: dollars(600), rateBps: 550 },
    { over: 80_650, upTo: 215_400, baseCents: dollars(4_271), rateBps: 600 },
    { over: 215_400, upTo: 1_077_550, baseCents: dollars(12_356), rateBps: 685 },
    { over: 1_077_550, upTo: 5_000_000, baseCents: dollars(71_413), rateBps: 965 },
    { over: 5_000_000, upTo: 25_000_000, baseCents: dollars(449_929), rateBps: 1030 },
    { over: 25_000_000, upTo: null, baseCents: dollars(2_509_929), rateBps: 1090 },
  ],
  tableBelow: 65_000,
  tableFirstRows: [13, 25, 50],
  tableStep: 50,
  householdCredit: [
    { upTo: 5_000, credit: 75 },
    { upTo: 6_000, credit: 60 },
    { upTo: 7_000, credit: 50 },
    { upTo: 20_000, credit: 45 },
    { upTo: 25_000, credit: 40 },
    { upTo: 28_000, credit: 20 },
    { upTo: null, credit: 0 },
  ],
  agiLimit: 107_650,
  sources: {
    form: { table: 'Which New York form', citation: 'A U.S. nonresident noncitizen who files Form 1040-NR may file New York Form IT-201 or IT-203 (Instructions for Form IT-203 (2025), page 39). With all wages earned in New York the income percentage is 100% (page 21), so both give the same tax. We figure it the Form IT-201 way.' },
    wages: { table: 'Wages', citation: 'Form IT-201 (2025), line 1 and line 19 (federal adjusted gross income). Wages are the only income counted: Form W-2, box 1.' },
    deduction: { table: 'Standard deduction', citation: 'Instructions for Form IT-201 (2025), page 11, New York State standard deduction table: Single, item C “No” = $8,000. Same table in the Instructions for Form IT-203 (2025), page 19.' },
    rates: { table: 'Tax rates', citation: 'Instructions for Form IT-201 (2025), page 33, New York State tax rate schedule, Single and married filing separately.' },
    taxTable: { table: 'Tax Table', citation: '2025 New York State Tax Table (tax.ny.gov/pit/file/tax-tables/it201i-2025.htm), Single or Married filing separately column. Used when taxable income is under $65,000 (Instructions for Form IT-201 (2025), pages 12 and 32).' },
    schedule: { table: 'Tax rate schedule', citation: 'Instructions for Form IT-201 (2025), pages 12, 32 and 33: taxable income of $65,000 or more uses the tax rate schedule (New York adjusted gross income of $107,650 or less).' },
    household: { table: 'Household credit', citation: 'Instructions for Form IT-201 (2025), page 12, New York State household credit table 1 (Single). It can lower the tax to zero but not below (Form IT-201 (2025), lines 40 to 44).' },
    rounding: { table: 'Rounding', citation: 'Instructions for Form IT-201 (2025), page 2: drop under 50 cents, round 50 cents or more up to the next dollar.' },
    withheld: { table: 'State tax withheld', citation: 'Form IT-201 (2025), line 72 (Total New York State tax withheld): Form W-2, box 17. New York City and Yonkers tax withheld (lines 73 and 74) are not counted.' },
    result: { table: 'Refund or amount owed', citation: 'Form IT-201 (2025), line 77 (amount overpaid) and line 80 (amount you owe). Instructions for Form IT-201 (2025), pages 22 and 23.' },
    limit: { table: 'Not built yet', citation: 'New York adjusted gross income over $107,650 uses the tax computation worksheets (Instructions for Form IT-201 (2025), pages 32 and 34).' },
  },
}

export const CALIFORNIA: CaConfig = {
  code: 'CA',
  name: 'California',
  standardDeduction: 5_706,
  exemptionCredit: 153,
  brackets: [
    { over: 0, upTo: 11_079, baseCents: 0, rateBps: 100 },
    { over: 11_079, upTo: 26_264, baseCents: 11_079, rateBps: 200 },
    { over: 26_264, upTo: 41_452, baseCents: 41_449, rateBps: 400 },
    { over: 41_452, upTo: 57_542, baseCents: 102_201, rateBps: 600 },
    { over: 57_542, upTo: 72_724, baseCents: 198_741, rateBps: 800 },
    { over: 72_724, upTo: 371_479, baseCents: 320_197, rateBps: 930 },
    { over: 371_479, upTo: 445_771, baseCents: 3_098_619, rateBps: 1030 },
    { over: 445_771, upTo: 742_953, baseCents: 3_863_827, rateBps: 1130 },
    { over: 742_953, upTo: null, baseCents: 7_221_984, rateBps: 1230 },
  ],
  tableUpTo: 100_000,
  tableFirstHi: 50,
  tableStep: 100,
  tableLastLo: 99_951,
  agiLimit: 252_203,
  sources: {
    form: { table: 'Which California form', citation: 'Form 540NR is for nonresidents; its tax is the tax on all taxable income times California’s share of it (Form 540NR booklet 2025, page 14, lines 36 and 38). With all wages earned in California that share is 100%, so Form 540 and Form 540NR give the same tax. We figure it the Form 540 way.' },
    wages: { table: 'Wages', citation: 'Form 540 (2025), line 13: “federal adjusted gross income (AGI) from federal Form 1040, 1040-SR, or 1040-NR, line 11b” (Personal Income Tax Booklet 2025, page 40). Wages are the only income counted: Form W-2, box 1.' },
    deduction: { table: 'Standard deduction', citation: 'Personal Income Tax Booklet 2025 (Form 540), page 13, Line 18 – Standard Deduction: filing status 1, Single = $5,706.' },
    rates: { table: 'Tax rates', citation: 'Personal Income Tax Booklet 2025 (Form 540), page 75, 2025 California Tax Rate Schedules, Schedule X (Single).' },
    taxTable: { table: 'Tax Table', citation: 'Personal Income Tax Booklet 2025 (Form 540), pages 69 to 73, 2025 California Tax Table, filing status 1 or 3 column. Used when taxable income is $100,000 or less (page 13, Line 31).' },
    schedule: { table: 'Tax rate schedule', citation: 'Personal Income Tax Booklet 2025 (Form 540), pages 13 and 75: taxable income over $100,000 uses Schedule X.' },
    exemption: { table: 'Exemption credit', citation: 'Form 540 (2025), line 7: personal exemption credit $153 (filing status 1, not claimed as a dependent); line 32 (Exemption credits), line 33 (cannot go below zero). Personal Income Tax Booklet 2025, pages 13 and 14.' },
    rounding: { table: 'Rounding', citation: 'Personal Income Tax Booklet 2025 (Form 540), page 75, “How to Figure Tax Using the 2025 California Tax Rate Schedules”: the amount is rounded to two decimals, added to the base, and the result is entered in whole dollars.' },
    withheld: { table: 'State tax withheld', citation: 'Form 540 (2025), line 71 (California income tax withheld): Form W-2, box 17. State Disability Insurance (box 14) is not income tax.' },
    result: { table: 'Refund or amount owed', citation: 'Form 540 (2025), line 64 (total tax), line 78 (total payments), line 111 (amount you owe) and line 115 (refund).' },
    limit: { table: 'Not built yet', citation: 'Federal AGI over $252,203: the exemption credit is limited (Personal Income Tax Booklet 2025, page 14, Line 32). Taxable income over $1,000,000 also owes the Behavioral Health Services Tax (page 16, Line 62).' },
  },
}

/** States that do not tax wages in 2025: official statements, one per state. */
export type NoWageTaxState = { code: string; name: string; source: Source }

const FTA = 'Federation of Tax Administrators, “2024 State Individual Income Tax Rates” (rates for tax year 2024, as of January 1, 2025), taxadmin.org/state-individual-income-tax-rates/: “No State Income Tax”.'

export const NO_WAGE_TAX_STATES: readonly NoWageTaxState[] = [
  { code: 'AK', name: 'Alaska', source: { table: 'Alaska', citation: `Alaska Department of Revenue, Tax Division, Annual Report 2023, history: “1980 – The Legislature repealed the parts of AS 43.20 that impose the individual income tax” (tax.alaska.gov/programs/programs/reports/AnnualReport.aspx?Year=2023). ${FTA}` } },
  { code: 'FL', name: 'Florida', source: { table: 'Florida', citation: `Florida Department of Revenue, FAQ “Do I have to file a personal income tax return in Florida?”: “Florida does not impose a personal income tax, so there are no filing requirements” (floridarevenue.com/faq/Pages/FAQDetails.aspx?FAQID=1466). ${FTA}` } },
  { code: 'NV', name: 'Nevada', source: { table: 'Nevada', citation: `Nevada Department of Taxation, “Income Tax in Nevada”: “The State of Nevada does not impose a state income tax on individuals” and “Nevada residents do not pay state tax on income earned from salaries, wages, or similar compensation” (tax.nv.gov/about-nevada-department-of-taxation/income-tax-in-nevada/). ${FTA}` } },
  { code: 'NH', name: 'New Hampshire', source: { table: 'New Hampshire', citation: 'New Hampshire Department of Revenue Administration, Interest & Dividends Tax page: “The State of New Hampshire does not have an income tax on an individual’s reported W-2 wages” and “Effective for taxable periods beginning after December 31, 2024, the Interest and Dividends tax is repealed” (revenue.nh.gov/taxes-glance/interest-dividends-tax; Technical Information Release TIR 2025-001). New Hampshire’s only personal income tax (interest and dividends) was repealed from 2025, which is why it is on this list for 2025 and not in the FTA table for 2024.' } },
  { code: 'SD', name: 'South Dakota', source: { table: 'South Dakota', citation: `South Dakota Department of Revenue, Taxes page: “South Dakota is one of seven states that does not impose a state income tax” (dor.sd.gov/individuals/taxes/). ${FTA}` } },
  { code: 'TN', name: 'Tennessee', source: { table: 'Tennessee', citation: 'Tennessee Department of Revenue, help article GEN-34: “Tennessee has no state income tax on earned income and therefore has no withholding requirements. … Hall income tax was repealed January 1, 2021”; Hall Income Tax manual (August 2022): “The Hall income tax was fully repealed for tax years beginning on or after January 1, 2021”, and it never applied to “salaries, wages, and commissions” (tn.gov/revenue/taxes/hall-income-tax.html). ' + FTA } },
  { code: 'TX', name: 'Texas', source: { table: 'Texas', citation: `Texas Comptroller of Public Accounts, Fiscal Notes 2025 “Texas is open for small business”: “Texas has no state income tax” (comptroller.texas.gov/economy/fiscal-notes/industry/2025/small-biz-info/). ${FTA}` } },
  { code: 'WA', name: 'Washington', source: { table: 'Washington', citation: `Washington Department of Revenue, “Income tax”: “Washington does not currently have an individual income tax” (dor.wa.gov/taxes-rates/income-tax). The 9.9% tax on adjusted gross income over $1 million starts January 1, 2028; the capital gains excise tax applies to gains, not wages. ${FTA}` } },
  { code: 'WY', name: 'Wyoming', source: { table: 'Wyoming', citation: `State of Wyoming, “About Wyoming” (wyo.gov/about-wyoming): “Wyoming does not possess an individual or corporate income tax”. ${FTA}` } },
]

export type StatesConfig = {
  ny: NyConfig
  ca: CaConfig
  noWageTax: readonly NoWageTaxState[]
  review: typeof TODO_CPA
}

export const STATES_2025: StatesConfig = { ny: NEW_YORK, ca: CALIFORNIA, noWageTax: NO_WAGE_TAX_STATES, review: TODO_CPA }
