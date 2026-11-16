// The state estimate: New York and California, wages only. Everything else says plainly why not.
// Pure. Reads the confirmed values as `TaxInput` (src/tax/input.ts, R1) and the year's figures from
// src/tax/years/*. Components never compute tax; they read the `Estimate`.
//
// Which state: the state on the W-2 (box 15), always, even if the person lives somewhere else.
// The rules, in this order (each one tested by `npm run check:state`):
//   1. a tax year with no verified figures        → "We can’t estimate this tax year yet."
//   2. something the person still has to confirm  → waits, no number
//   3. no W-2, no state on a W-2, or more than one state → no number, says why
//   4. a state with no tax on wages               → "This state has no income tax on wages. No state return needed"
//   5. any state but NY and CA                    → "State return not supported yet" + the amount withheld
//   6. income this engine can't handle            → no number, says which
//   7. NY / CA                                    → the estimate (refund or amount owed)
import { roundToDollars } from './engine.ts'
import type { Calculated, EstimateLine, NoTax, NotCalculated, NotSupported, Section, Source } from './estimate.ts'
import type { TaxInput } from './input.ts'
import { caTax, nyHouseholdCredit, nyTax } from './stateEngine.ts'
import type { CaConfig, NyConfig } from './years/states-2025.ts'
import { yearConfig } from './years/index.ts'

export type StateSection = Section & { code: string | null }

export const NO_WAGE_TAX_MESSAGE = 'This state has no income tax on wages. No state return needed'
export const NOT_SUPPORTED_MESSAGE = 'State return not supported yet'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const cents = (dollars: number) => dollars * 100

export function stateSection(input: TaxInput): StateSection {
  const codes = [...new Set(input.wages.map((w) => w.stateCode))]
  const code = input.wages[0]?.stateCode ?? null
  const notCalculated = (...missing: string[]): NotCalculated & { code: string | null } => ({ code, status: 'not-calculated', missing })

  const cfg = yearConfig(input.year)
  if (!cfg) return { code, status: 'not-supported', message: 'We can’t estimate this tax year yet.' } satisfies NotSupported & { code: string | null }
  if (input.blockers.length) return notCalculated('Waiting for the items listed above.')
  if (!input.wages.length) return notCalculated('There’s no W-2 to take the state from.')
  if (codes.some((c) => !c)) return notCalculated('Your W-2 doesn’t show a state, so we can’t tell which state return applies.')
  if (codes.length > 1) return { ...notCalculated('Your W-2s are from more than one state. The estimate can’t handle that yet.'), code: null }

  const states = cfg.states
  const noTax = states.noWageTax.find((s) => s.code === code)
  if (noTax) return { code, status: 'no-tax', message: NO_WAGE_TAX_MESSAGE, sources: [noTax.source] } satisfies NoTax & { code: string | null }

  const wages = roundToDollars(input.wages.reduce((n, w) => n + w.wages, 0))
  const withheld = roundToDollars(input.wages.reduce((n, w) => n + w.stateWithheld, 0))
  const supported = code === states.ny.code || code === states.ca.code
  if (!supported) return { code, status: 'not-supported', message: NOT_SUPPORTED_MESSAGE, withheld: cents(withheld) }

  if (input.other.length) {
    const names = [...new Set(input.other.map((o) => o.label))]
    return notCalculated(...names.map((n) => `We can’t include ${n} in the estimate yet.`))
  }
  return code === 'NY' ? newYork(states.ny, wages, withheld, input) : california(states.ca, wages, withheld, input)
}

type Line = Omit<EstimateLine, 'amount'> & { dollars: number }
const toLines = (ls: Line[]): EstimateLine[] => ls.map(({ dollars, ...rest }) => ({ ...rest, amount: cents(dollars) }))
const from = (input: TaxInput) => (input.wages.length > 1 ? 'From your W-2s' : 'From your W-2')

function result(code: string, lines: EstimateLine[], sources: Source[], diff: number): Calculated & { code: string } {
  return { code, status: diff > 0 ? 'refund' : diff < 0 ? 'owed' : 'zero', amount: cents(Math.abs(diff)), lines, sources }
}

// ---- New York: Form IT-201 (full-year resident; the same tax as Form IT-203 for wages earned in New York) ----
function newYork(ny: NyConfig, wages: number, withheld: number, input: TaxInput): StateSection {
  const agi = wages // federal AGI = wages (line 19); New York adjusted gross income = the same (line 33): no additions or subtractions
  const S = ny.sources
  if (agi > ny.agiLimit) return { code: 'NY', status: 'not-calculated', missing: [`New York’s extra calculation for income over ${usd(ny.agiLimit)} isn’t built yet.`] }

  const deduction = Math.min(ny.standardDeduction, agi) // line 34 (line 35 can't go below zero)
  const taxable = agi - deduction // lines 35, 37, 38 (no dependents)
  const { tax, method } = nyTax(ny, taxable) // line 39
  const credit = Math.min(nyHouseholdCredit(ny, agi), tax) // line 40, limited to the tax (line 44 can't go below zero)
  const total = tax - credit // lines 44 and 46 (no other taxes)
  const diff = withheld - total // line 72 minus line 46
  const lines = toLines([
    { id: 'state-wages', group: 'income', label: 'Wages', formLine: 'Form IT-201, line 1', from: from(input), source: 'Form IT-201 (2025), page 1', dollars: wages },
    { id: 'state-agi', group: 'income', label: 'New York adjusted gross income', formLine: 'Form IT-201, line 33', from: 'Wages are the only income counted', source: 'Form IT-201 (2025), page 2', dollars: agi },
    { id: 'state-deduction', group: 'deductions', label: 'Standard deduction', formLine: 'Form IT-201, line 34', from: 'Single, itemized deductions not included', source: 'Instructions for Form IT-201 (2025), page 11', dollars: deduction },
    { id: 'state-taxable', group: 'deductions', label: 'Taxable income', formLine: 'Form IT-201, line 38', source: 'Form IT-201 (2025), page 3', dollars: taxable },
    {
      id: 'state-tax',
      group: 'tax',
      label: 'New York State tax',
      formLine: 'Form IT-201, line 39',
      from: method === 'table' ? 'From the 2025 New York State Tax Table' : 'From the New York State tax rate schedule',
      source: method === 'table' ? 'New York State Tax Table (2025), tax.ny.gov' : 'Instructions for Form IT-201 (2025), page 33',
      dollars: tax,
    },
    { id: 'state-credit', group: 'tax', label: 'Household credit', formLine: 'Form IT-201, line 40', from: credit ? 'Single, by income' : 'None at this income', source: 'Instructions for Form IT-201 (2025), page 12', dollars: credit },
    { id: 'state-total-tax', group: 'tax', label: 'Total New York State tax', formLine: 'Form IT-201, line 46', from: 'City taxes (New York City, Yonkers) not included', source: 'Form IT-201 (2025), page 3', dollars: total },
    { id: 'state-withheld', group: 'payments', label: 'New York State tax withheld', formLine: 'Form IT-201, line 72', from: from(input) + ', box 17', source: 'Form IT-201 (2025), page 4', dollars: withheld },
    {
      id: 'state-result',
      group: 'result',
      label: diff > 0 ? 'Refund' : diff < 0 ? 'Amount owed' : 'No refund, nothing owed',
      formLine: diff >= 0 ? 'Form IT-201, line 77' : 'Form IT-201, line 80',
      from: 'Payments minus tax',
      source: 'Instructions for Form IT-201 (2025), pages 22 and 23',
      dollars: Math.abs(diff),
    },
  ])
  const sources = [S.form, S.wages, S.deduction, S.rounding, method === 'table' ? S.taxTable : S.schedule, S.rates, S.household, S.withheld, S.result]
  return result('NY', lines, sources, diff)
}

// ---- California: Form 540 (the same tax as Form 540NR for wages earned in California) ----
function california(ca: CaConfig, wages: number, withheld: number, input: TaxInput): StateSection {
  const agi = wages // federal AGI = wages (line 13); California AGI = the same (line 17): no adjustments
  const S = ca.sources
  if (agi > ca.agiLimit) return { code: 'CA', status: 'not-calculated', missing: [`California’s limit on the exemption credit for income over ${usd(ca.agiLimit)} isn’t built yet.`] }

  const deduction = Math.min(ca.standardDeduction, agi) // line 18
  const taxable = agi - deduction // line 19
  const { tax, method } = caTax(ca, taxable) // line 31
  const credit = Math.min(ca.exemptionCredit, tax) // line 32 (line 33 can't go below zero)
  const total = tax - credit // lines 33, 48 and 64 (no other taxes)
  const diff = withheld - total // line 71 minus line 64
  const lines = toLines([
    { id: 'state-wages', group: 'income', label: 'Wages', formLine: 'Form 540, line 13', from: from(input), source: 'Personal Income Tax Booklet 2025, page 40', dollars: wages },
    { id: 'state-agi', group: 'income', label: 'California adjusted gross income', formLine: 'Form 540, line 17', from: 'Wages are the only income counted', source: 'Personal Income Tax Booklet 2025, page 40', dollars: agi },
    { id: 'state-deduction', group: 'deductions', label: 'Standard deduction', formLine: 'Form 540, line 18', from: 'Single, itemized deductions not included', source: 'Personal Income Tax Booklet 2025, page 13', dollars: deduction },
    { id: 'state-taxable', group: 'deductions', label: 'Taxable income', formLine: 'Form 540, line 19', source: 'Personal Income Tax Booklet 2025, page 40', dollars: taxable },
    {
      id: 'state-tax',
      group: 'tax',
      label: 'California tax',
      formLine: 'Form 540, line 31',
      from: method === 'table' ? 'From the 2025 California Tax Table' : 'From Schedule X, Single',
      source: method === 'table' ? 'Personal Income Tax Booklet 2025, pages 69 to 73' : 'Personal Income Tax Booklet 2025, page 75',
      dollars: tax,
    },
    { id: 'state-credit', group: 'tax', label: 'Exemption credit', formLine: 'Form 540, line 32', from: 'One personal exemption', source: 'Personal Income Tax Booklet 2025, page 14', dollars: credit },
    { id: 'state-total-tax', group: 'tax', label: 'Total California tax', formLine: 'Form 540, line 64', from: 'Other credits not included', source: 'Personal Income Tax Booklet 2025, page 41', dollars: total },
    { id: 'state-withheld', group: 'payments', label: 'California tax withheld', formLine: 'Form 540, line 71', from: from(input) + ', box 17', source: 'Personal Income Tax Booklet 2025, page 41', dollars: withheld },
    {
      id: 'state-result',
      group: 'result',
      label: diff > 0 ? 'Refund' : diff < 0 ? 'Amount owed' : 'No refund, nothing owed',
      formLine: diff >= 0 ? 'Form 540, line 115' : 'Form 540, line 111',
      from: 'Payments minus tax',
      source: 'Personal Income Tax Booklet 2025, page 43',
      dollars: Math.abs(diff),
    },
  ])
  const sources = [S.form, S.wages, S.deduction, S.rounding, method === 'table' ? S.taxTable : S.schedule, S.rates, S.exemption, S.withheld, S.result]
  return result('CA', lines, sources, diff)
}
