// R2: the federal estimate for ONE kind of return: nonresident, single, wages only, no treaty
// benefits, no deductions yet. Anything else gives NO number and a plain message (never a guess).
// Pure. Reads the confirmed values as `TaxInput` (src/tax/input.ts, R1) and the year's figures
// from src/tax/years/*. Components never compute tax; they read the `Estimate`.
import { federalTax, roundToDollars } from './engine.ts'
import type { Calculated, EstimateLine, NotCalculated, NotSupported, Source } from './estimate.ts'
import type { TaxInput } from './input.ts'
import { yearConfig } from './years/index.ts'

const cents = (dollars: number) => dollars * 100

export function federalSection(input: TaxInput): Calculated | NotCalculated | NotSupported {
  const cfg = yearConfig(input.year)
  if (!cfg) return { status: 'not-supported', message: 'We can’t estimate this tax year yet.' }

  // 1. Something the person still has to confirm
  if (input.blockers.length) return { status: 'not-calculated', missing: ['Waiting for the items listed above.'] }

  // 2. Income the engine can't handle: no number, and say which
  if (input.other.length) {
    const names = [...new Set(input.other.map((o) => o.label))]
    return { status: 'not-calculated', missing: names.map((n) => `We can’t include ${n} in the estimate yet.`) }
  }

  // 3. Nothing to calculate from
  if (!input.wages.length) return { status: 'not-calculated', missing: ['There’s no W-2 to calculate from.'] }

  // Add the cents first, round only the totals (Instructions for Form 1040, "Rounding Off to Whole Dollars")
  const wages = roundToDollars(input.wages.reduce((n, w) => n + w.wages, 0))
  const withheld = roundToDollars(input.wages.reduce((n, w) => n + w.federalWithheld, 0))

  const totalIncome = wages // wages are the only income counted (line 9 = line 1z = line 1a)
  const deductions = 0 // not included yet (line 12): itemized deductions come in R3
  const taxable = Math.max(0, totalIncome - deductions) // line 15
  const { tax, method } = federalTax(cfg, taxable) // line 16 (= line 24: nothing else is added)
  const diff = withheld - tax // line 33 minus line 24
  const S = cfg.sources
  const short = (s: Source) => s.citation
  const employer = input.wages.length === 1 ? input.wages[0].employer : null

  const line = (l: Omit<EstimateLine, 'amount'> & { dollars: number }): EstimateLine => {
    const { dollars, ...rest } = l
    return { ...rest, amount: cents(dollars) }
  }
  const lines: EstimateLine[] = [
    line({ id: 'wages', group: 'income', label: 'Wages', formLine: 'Form 1040-NR, line 1a', from: input.wages.length > 1 ? 'From your W-2s' : employer ? `From your W-2, ${employer}` : 'From your W-2', source: 'Instructions for Form 1040-NR (2025), page 17', dollars: wages }),
    line({ id: 'total-income', group: 'income', label: 'Total income', formLine: 'Form 1040-NR, line 9', from: 'Wages are the only income counted', source: 'Form 1040-NR (2025), page 1', dollars: totalIncome }),
    line({ id: 'deduction', group: 'deductions', label: 'Deductions', formLine: 'Form 1040-NR, line 12', from: 'Not included yet', source: 'Instructions for Form 1040-NR (2025), page 20', dollars: deductions }),
    line({ id: 'taxable', group: 'deductions', label: 'Taxable income', formLine: 'Form 1040-NR, line 15', source: 'Form 1040-NR (2025), page 2', dollars: taxable }),
    line({
      id: 'tax',
      group: 'tax',
      label: 'Tax',
      formLine: 'Form 1040-NR, line 16',
      from: method === 'table' ? 'From the 2025 Tax Table, Single column' : 'From the Tax Computation Worksheet, Single',
      source: method === 'table' ? 'Instructions for Form 1040 (2025), pages 68–79' : 'Instructions for Form 1040 (2025), page 80',
      dollars: tax,
    }),
    line({ id: 'withheld', group: 'payments', label: 'Federal tax withheld', formLine: 'Form 1040-NR, line 25a', from: input.wages.length > 1 ? 'From your W-2s, box 2' : 'From your W-2, box 2', source: 'Instructions for Form 1040-NR (2025), page 22', dollars: withheld }),
    line({
      id: 'result',
      group: 'result',
      label: diff > 0 ? 'Refund' : diff < 0 ? 'Amount owed' : 'No refund, nothing owed',
      formLine: diff >= 0 ? 'Form 1040-NR, line 34' : 'Form 1040-NR, line 37',
      from: 'Payments minus tax',
      source: 'Instructions for Form 1040-NR (2025), page 23',
      dollars: Math.abs(diff),
    }),
  ]

  return {
    status: diff > 0 ? 'refund' : diff < 0 ? 'owed' : 'zero',
    amount: cents(Math.abs(diff)),
    lines,
    sources: [S.wages, S.rounding, S.deductions, S.lineChoice, method === 'table' ? S.taxTable : S.worksheet, S.brackets, S.withheld, S.refundOwed].map((s) => ({ table: s.table, citation: short(s) })),
  }
}
