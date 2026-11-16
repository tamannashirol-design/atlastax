// R2: the federal estimate for ONE kind of return: nonresident, single, wages only, no deductions
// yet. Treaty benefits: only the India student standard deduction and the China student wage
// exemption (src/tax/treaty.ts). Anything else gives NO number and a plain message (never a guess).
// Pure. Reads the confirmed values as `TaxInput` (src/tax/input.ts, R1) and the year's figures
// from src/tax/years/*. Components never compute tax; they read the `Estimate`.
import { federalTax, roundToDollars } from './engine.ts'
import type { Calculated, EstimateLine, NotCalculated, NotSupported, Source } from './estimate.ts'
import type { TaxInput } from './input.ts'
import { noNumberReasons } from './stops.ts'
import { treatyFor } from './treaty.ts'
import { yearConfig } from './years/index.ts'

const cents = (dollars: number) => dollars * 100
const usd = (n: number) => `$${n.toLocaleString('en-US')}`

export function federalSection(input: TaxInput): Calculated | NotCalculated | NotSupported {
  const cfg = yearConfig(input.year)
  if (!cfg) return { status: 'not-supported', message: 'We can’t estimate this tax year yet.' }

  // 1. Something the person still has to confirm
  // 1b. An answer that means no number yet (married, digital assets): say why (src/tax/stops.ts)
  const stops = noNumberReasons(input)
  if (input.blockers.length || stops.length) return { status: 'not-calculated', missing: [...(input.blockers.length ? ['Waiting for the items listed above.'] : []), ...stops] }

  // 2. Income the engine can't handle: no number, and say which
  if (input.other.length) {
    const names = [...new Set(input.other.map((o) => o.label))]
    return { status: 'not-calculated', missing: names.map((n) => `We can’t include ${n} in the estimate yet.`) }
  }

  // 3. Nothing to calculate from
  if (!input.wages.length) return { status: 'not-calculated', missing: ['There’s no W-2 to calculate from.'] }

  // Add the cents first, round only the totals (Instructions for Form 1040, "Rounding Off to Whole Dollars")
  const w2Wages = roundToDollars(input.wages.reduce((n, w) => n + w.wages, 0))
  const withheld = roundToDollars(input.wages.reduce((n, w) => n + w.federalWithheld, 0))

  // Student treaty benefit, from the citizenship the person gave (src/tax/treaty.ts). Federal only.
  //   China: up to $5,000 of wages exempt: out of line 1a, shown on line 1k (Instructions for Form 1040-NR, page 18)
  //   India: the standard deduction on line 12 (Publication 519, pages 39 and 40), never more than the income
  const treaty = treatyFor(input, cfg)
  const exempt = treaty?.kind === 'wage-exemption' ? Math.min(w2Wages, treaty.exemptWagesPerYear) : 0
  const wages = w2Wages - exempt // line 1a
  const totalIncome = wages // wages are the only income counted (line 9 = line 1z = line 1a)
  // line 12: the India treaty standard deduction; otherwise not included yet (itemized deductions come in R3)
  const deductions = treaty?.kind === 'standard-deduction' ? Math.min(treaty.standardDeductionSingle, totalIncome) : 0
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
  const fromW2 = input.wages.length > 1 ? 'From your W-2s' : employer ? `From your W-2, ${employer}` : 'From your W-2'
  const china = treaty?.kind === 'wage-exemption' ? treaty : null
  const treatyLines: EstimateLine[] = china
    ? [
        line({ id: 'wages-w2', group: 'income', label: 'Wages on your W-2', formLine: 'Form W-2, box 1', from: fromW2, source: 'Instructions for Form 1040-NR (2025), page 17', dollars: w2Wages }),
        line({ id: 'treaty', group: 'income', label: `Less: treaty exemption (${china.country})`, formLine: 'Form 1040-NR, line 1k', from: `Student wages, up to ${usd(china.exemptWagesPerYear)} a year, ${china.article}`, source: 'Publication 901 (9-2024), page 30; Publication 519 (2025), page 80', treaty: true, dollars: exempt }),
      ]
    : []
  const lines: EstimateLine[] = [
    ...treatyLines,
    line({
      id: 'wages',
      group: 'income',
      label: china ? 'Wages counted' : 'Wages',
      formLine: 'Form 1040-NR, line 1a',
      from: china ? 'W-2 wages minus the treaty exemption' : fromW2,
      source: china ? 'Instructions for Form 1040-NR (2025), page 18' : 'Instructions for Form 1040-NR (2025), page 17',
      dollars: wages,
    }),
    line({ id: 'total-income', group: 'income', label: 'Total income', formLine: 'Form 1040-NR, line 9', from: 'Wages are the only income counted', source: 'Form 1040-NR (2025), page 1', dollars: totalIncome }),
    treaty?.kind === 'standard-deduction'
      ? line({ id: 'deduction', group: 'deductions', label: `Standard deduction (${treaty.country} treaty)`, formLine: 'Form 1040-NR, line 12', from: `Student, U.S.–${treaty.country} treaty, ${treaty.article}`, source: 'Publication 519 (2025), pages 39 and 40', treaty: true, dollars: deductions })
      : line({ id: 'deduction', group: 'deductions', label: 'Deductions', formLine: 'Form 1040-NR, line 12', from: 'Not included yet', source: 'Instructions for Form 1040-NR (2025), page 20', dollars: deductions }),
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
    sources: [
      S.wages,
      ...(treaty?.kind === 'wage-exemption' ? [treaty.sources.rule, treaty.sources.amount, treaty.sources.reporting] : []),
      S.rounding,
      ...(treaty?.kind === 'standard-deduction' ? [treaty.sources.rule, treaty.sources.amount, treaty.sources.conditions] : [S.deductions]),
      S.lineChoice,
      method === 'table' ? S.taxTable : S.worksheet,
      S.brackets,
      S.withheld,
      S.refundOwed,
    ].map((s) => ({ table: s.table, citation: short(s) })),
  }
}
