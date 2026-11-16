// The federal tax arithmetic, step by step as Form 1040-NR does it. Pure: no React, no network,
// no figures of its own (they all come from src/tax/years/*). `npm run check:tax` tests it.
//
// Two ways to get the tax on taxable income (whole dollars):
//   - under the worksheet limit ($100,000): the Tax Table
//   - at or above it: the Tax Computation Worksheet, Section A (Single)
import type { Bracket, YearConfig } from './years/2025.ts'

/** Round cents to whole dollars the IRS way: 50 to 99 cents goes up, under 50 cents goes down. Non-negative only. */
export const roundToDollars = (cents: number): number => Math.floor((cents + 50) / 100)

/**
 * Tax on an amount from the printed rate table, as exact "centicents" (1/10,000 of a dollar),
 * so nothing is ever a fraction. `amountCents` is the amount in cents.
 */
function rateTableCenticents(brackets: readonly Bracket[], amountCents: number): number {
  const b = brackets.find((x) => x.upTo === null || amountCents <= x.upTo * 100) ?? brackets[brackets.length - 1]
  return b.baseCents * 100 + b.ratePercent * (amountCents - b.over * 100)
}
const centicentsToDollars = (c: number) => Math.floor((c + 5000) / 10_000)

/** The Tax Table row (at least `lo`, but less than `hi`, whole dollars) that holds this taxable income. */
export function taxTableRow(cfg: YearConfig, taxable: number): [number, number] {
  const t = cfg.taxTable
  let lo = 0
  for (const hi of t.firstRows) {
    if (taxable < hi) return [lo, hi]
    lo = hi
  }
  if (taxable < t.stepsOf25Until) {
    lo = lo + Math.floor((taxable - lo) / t.step25) * t.step25
    return [lo, lo + t.step25]
  }
  lo = t.stepsOf25Until + Math.floor((taxable - t.stepsOf25Until) / t.step50) * t.step50
  return [lo, lo + t.step50]
}

/** Tax Table: the tax on the row's middle amount, rounded to whole dollars (that is how the IRS prints it). */
export function taxFromTable(cfg: YearConfig, taxable: number): number {
  const [lo, hi] = taxTableRow(cfg, taxable)
  return centicentsToDollars(rateTableCenticents(cfg.brackets, (lo + hi) * 50))
}

/** Tax Computation Worksheet, Section A: amount × rate − subtraction amount, rounded to whole dollars. */
export function taxFromWorksheet(cfg: YearConfig, taxable: number): number {
  const row = cfg.worksheet.find((r) => r.upTo === null || taxable <= r.upTo)
  if (!row || taxable < row.over) throw new Error('taxable income is below the worksheet range')
  // taxable dollars × rate% = cents exactly
  return roundToDollars(row.ratePercent * taxable - row.subtractCents)
}

export type Method = 'table' | 'worksheet'
/** The tax on taxable income (whole dollars), and which method the IRS says to use. */
export function federalTax(cfg: YearConfig, taxable: number): { tax: number; method: Method } {
  if (!Number.isInteger(taxable) || taxable < 0) throw new Error('taxable income must be whole dollars, zero or more')
  return taxable < cfg.taxTable.worksheetFrom ? { tax: taxFromTable(cfg, taxable), method: 'table' } : { tax: taxFromWorksheet(cfg, taxable), method: 'worksheet' }
}
