// THE INTERFACE between the tax engine and /result: `Estimate`. The page reads this
// and nothing else; connecting the real engine later only changes what produces it.
// Pure: no React, no network (the server calls estimateReturn, the browser reads the result).
//
// `federal` comes from the engine (src/tax/federal.ts, R2: wages only), `state` from
// src/tax/state.ts (New York and California, wages only; no-tax states say so; every
// other state says "not supported yet"). Never a made-up number: anything the engine
// can't handle says what is missing. Money is in whole CENTS. Amounts are `null`
// when the person turned the number off (hideNumbers).
//
// Every section is labelled "Estimate (prototype)" on screen (ESTIMATE_LABEL).
import { federalSection } from './federal.ts'
import type { Blocker, TaxInput } from './input.ts'
import { stateSection } from './state.ts'

export const ESTIMATE_LABEL = 'Estimate (prototype)'
/** Always shown on /result, in this wording */
export const RESULT_NOTES = ['Assumes single filing status.', 'Treaty benefits aren’t included yet.'] as const

export type LineGroup = 'income' | 'deductions' | 'tax' | 'payments' | 'result'
export type EstimateLine = {
  id: string
  group: LineGroup
  label: string
  /** Small muted text, e.g. "Form 1040-NR, line 1a" */
  formLine?: string
  /** Cents, or null when numbers are hidden */
  amount: number | null
  /** Where it came from, e.g. "From your W-2, Sample Employer" */
  from?: string
  /** The IRS publication and page behind this line, e.g. "Instructions for Form 1040-NR (2025), page 17" */
  source?: string
}
/** An IRS (or state) figure the calculation used, with its citation */
export type Source = { table: string; citation: string }

/** A calculated section. `amount` is always positive; `status` says which way it goes. */
export type Calculated = { status: 'refund' | 'owed' | 'zero'; amount: number | null; lines: EstimateLine[]; sources: Source[] }
/** The engine for this section doesn't exist yet (or is waiting on something): say what's missing */
export type NotCalculated = { status: 'not-calculated'; missing: string[] }
/** A part we can't do (e.g. another state): a plain message, and what was withheld if we know it */
export type NotSupported = { status: 'not-supported'; message: string; withheld?: number | null }
/** A state with no income tax on wages: nothing to calculate, nothing to file. No number. */
export type NoTax = { status: 'no-tax'; message: string; sources: Source[] }
export type Section = Calculated | NotCalculated | NotSupported | NoTax

export type FormStatus = { id: 'form-8843' | 'form-1040nr'; label: string; status: 'not-ready' | 'ready'; reason?: string }

export type Estimate = {
  year: number
  /** Why there is no number yet (from R1). Empty: nothing the person can fix. */
  blockers: Blocker[]
  federal: Section
  /** `code`: the W-2's state (two letters), when known */
  state: Section & { code: string | null }
  notes: string[]
  forms: FormStatus[]
  /** The person turned the number off: no amount anywhere */
  numbersHidden: boolean
}

export const isCalculated = (s: Section): s is Calculated => s.status === 'refund' || s.status === 'owed' || s.status === 'zero'

/** Refund positive, owed negative, in cents. null when hidden. */
const signed = (s: Calculated) => (s.amount === null ? null : s.status === 'refund' ? s.amount : s.status === 'owed' ? -s.amount : 0)

/** Federal and state together: ONLY when both are calculated (and the numbers are shown). */
export function combined(e: Pick<Estimate, 'federal' | 'state'>): { status: 'refund' | 'owed' | 'zero'; amount: number } | null {
  if (!isCalculated(e.federal) || !isCalculated(e.state)) return null
  const a = signed(e.federal)
  const b = signed(e.state)
  if (a === null || b === null) return null
  const net = a + b
  return { status: net > 0 ? 'refund' : net < 0 ? 'owed' : 'zero', amount: Math.abs(net) }
}

export const FORMS_NOT_READY: FormStatus[] = [
  { id: 'form-8843', label: 'Form 8843', status: 'not-ready' },
  { id: 'form-1040nr', label: 'Form 1040-NR', status: 'not-ready' },
]

/**
 * The estimate from the confirmed values. Federal: the engine (R2). State: src/tax/state.ts
 * (the W-2's state). Pure; the server runs it, the browser only reads the result.
 */
export function estimateReturn(input: TaxInput): Estimate {
  return {
    year: input.year,
    blockers: input.blockers,
    federal: federalSection(input),
    state: stateSection(input),
    notes: [...RESULT_NOTES],
    forms: FORMS_NOT_READY,
    numbersHidden: false,
  }
}

/** The person turned the number off: every amount disappears (also on the server, so none is sent). */
export function hideNumbers(e: Estimate): Estimate {
  const hide = <T extends Section>(s: T): T =>
    isCalculated(s) ? { ...s, amount: null, lines: s.lines.map((l) => ({ ...l, amount: null })) } : s.status === 'not-supported' ? { ...s, withheld: s.withheld === undefined ? undefined : null } : s
  return { ...e, federal: hide(e.federal), state: hide(e.state), numbersHidden: true }
}
