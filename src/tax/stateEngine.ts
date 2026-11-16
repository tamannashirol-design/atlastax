// State tax arithmetic for New York and California, step by step as each state's form does it.
// Pure: no React, no network, no figures of its own (they all come from src/tax/years/states-2025.ts).
// `npm run check:state` tests it against every row of both states' printed Tax Tables.
//
// All math is exact integers. A tax is held as "centicents" (1/10,000 of a cent, so 1/1,000,000 of a
// dollar): base (cents) × 10,000 + rate (basis points) × amount (cents). Rounding to dollars or cents
// happens only at the end, half up (50 cents or more rounds up: both states say so).
import type { CaConfig, NyConfig, StateBracket } from './years/states-2025.ts'

const bracketFor = (brackets: readonly StateBracket[], amountCents: number) => brackets.find((b) => b.upTo === null || amountCents <= b.upTo * 100) ?? brackets[brackets.length - 1]

/** Tax from a printed rate schedule on an amount in cents, in centicents (nothing rounded yet) */
function schedule(brackets: readonly StateBracket[], amountCents: number): number {
  const b = bracketFor(brackets, amountCents)
  return b.baseCents * 10_000 + b.rateBps * (amountCents - b.over * 100)
}
export const centicentsToDollars = (c: number) => Math.floor((c + 500_000) / 1_000_000)

// ------------------------------------------------------------------------------------------------
// NEW YORK (Form IT-201): Tax Table under $65,000 of taxable income, the rate schedule from there up

/** The Tax Table row (at least `lo`, but less than `hi`, whole dollars) that holds this taxable income. */
export function nyTableRow(cfg: NyConfig, taxable: number): [number, number] {
  let lo = 0
  for (const hi of cfg.tableFirstRows) {
    if (taxable < hi) return [lo, hi]
    lo = hi
  }
  lo = lo + Math.floor((taxable - lo) / cfg.tableStep) * cfg.tableStep
  return [lo, lo + cfg.tableStep]
}

/** The Tax Table: the tax on the row's middle amount, rounded to whole dollars. */
export function nyTaxFromTable(cfg: NyConfig, taxable: number): number {
  const [lo, hi] = nyTableRow(cfg, taxable)
  return centicentsToDollars(schedule(cfg.brackets, (lo + hi) * 50))
}

/** The rate schedule on a whole-dollar taxable income, rounded to whole dollars. */
export const nyTaxFromSchedule = (cfg: NyConfig, taxable: number): number => centicentsToDollars(schedule(cfg.brackets, taxable * 100))

export type StateMethod = 'table' | 'schedule'

export function nyTax(cfg: NyConfig, taxable: number): { tax: number; method: StateMethod } {
  assertDollars(taxable)
  return taxable < cfg.tableBelow ? { tax: nyTaxFromTable(cfg, taxable), method: 'table' } : { tax: nyTaxFromSchedule(cfg, taxable), method: 'schedule' }
}

/** Household credit table 1 (Single), by federal AGI (whole dollars; zero or negative is the first row). */
export function nyHouseholdCredit(cfg: NyConfig, federalAgi: number): number {
  assertDollars(federalAgi, true)
  return (cfg.householdCredit.find((r) => r.upTo === null || federalAgi <= r.upTo) ?? { credit: 0 }).credit
}

// ------------------------------------------------------------------------------------------------
// CALIFORNIA (Form 540): Tax Table up to $100,000 of taxable income, Schedule X above it

/** The Tax Table row (at least `lo`, but not over `hi`, whole dollars) that holds this taxable income (1 or more). */
export function caTableRow(cfg: CaConfig, taxable: number): [number, number] {
  if (taxable <= cfg.tableFirstHi) return [1, cfg.tableFirstHi]
  if (taxable >= cfg.tableLastLo) return [cfg.tableLastLo, cfg.tableUpTo]
  const first = cfg.tableFirstHi + 1
  const lo = first + Math.floor((taxable - first) / cfg.tableStep) * cfg.tableStep
  return [lo, lo + cfg.tableStep - 1]
}

/** The Tax Table: the tax on the row's middle amount, rounded to whole dollars. No tax on zero. */
export function caTaxFromTable(cfg: CaConfig, taxable: number): number {
  if (taxable <= 0) return 0
  const [lo, hi] = caTableRow(cfg, taxable)
  return centicentsToDollars(schedule(cfg.brackets, (lo + hi) * 50))
}

/**
 * A Schedule: "base plus rate of the excess". The state's steps: multiply, round that to cents,
 * add the base, round the result to whole dollars (Booklet page 75). Takes the brackets so the
 * state's own worked example (Schedule Y) can be checked too.
 */
export function caScheduleTax(brackets: readonly StateBracket[], taxable: number): number {
  assertDollars(taxable)
  const b = bracketFor(brackets, taxable * 100)
  const excessCents = Math.floor((b.rateBps * (taxable - b.over) + 50) / 100) // rate × excess, rounded to cents
  return Math.floor((b.baseCents + excessCents + 50) / 100)
}

export function caTax(cfg: CaConfig, taxable: number): { tax: number; method: StateMethod } {
  assertDollars(taxable)
  return taxable <= cfg.tableUpTo ? { tax: caTaxFromTable(cfg, taxable), method: 'table' } : { tax: caScheduleTax(cfg.brackets, taxable), method: 'schedule' }
}

function assertDollars(n: number, allowNegative = false) {
  if (!Number.isInteger(n) || (!allowNegative && n < 0)) throw new Error('amounts must be whole dollars' + (allowNegative ? '' : ', zero or more'))
}
