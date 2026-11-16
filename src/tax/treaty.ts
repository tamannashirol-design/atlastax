// Which student treaty benefit applies to this person, if any. Pure. Used by the federal estimate
// (src/tax/federal.ts) and for the result page's notes. Never applies to the state numbers.
//
// The rule: the citizenship the person already gave (two-letter region code) is India or China AND the
// visa is a student visa (the questions only continue for students). That is everything the app knows.
// What it can't know (where they were a resident just before coming, the time limits) is listed as
// assumptions in src/tax/years/treaties-2025.ts and shown in the breakdown.
import { STUDENT_VISAS } from '../residency.config.ts'
import type { TaxInput } from './input.ts'
import type { YearConfig } from './years/2025.ts'
import type { Treaty } from './years/treaties-2025.ts'

const STUDENT_VISA_LIST: readonly string[] = [...STUDENT_VISAS.always, ...STUDENT_VISAS.askIfStudent]

export function treatyFor(input: TaxInput, cfg: YearConfig): Treaty | null {
  const code = input.person.citizenship?.trim().toUpperCase()
  const treaty = code ? cfg.treaties[code] : undefined
  if (!treaty) return null
  const visa = input.person.visa
  if (!visa || !STUDENT_VISA_LIST.includes(visa)) return null
  return treaty
}
