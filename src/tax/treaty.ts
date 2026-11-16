// Which student treaty benefit applies to this person, if any. Pure. Used by the federal estimate
// (src/tax/federal.ts) and for the result page's notes. Never applies to the state numbers.
//
// The rule: where the person LIVED just before coming to the U.S. (their answer to "Where did you live before
// coming to the U.S.?", a two-letter region code) is India or China, AND the visa is a student visa (the questions
// only continue for students). Treaties go by residence, not citizenship (Pub 901: India "a resident of India
// immediately before visiting the United States"; China "a resident of the People's Republic of China on the date
// of arrival"). Citizenship is not used. What the app still can't know (the time limits, that they're here only
// to study) is listed in src/tax/years/treaties-2025.ts.
import { STUDENT_VISAS } from '../residency.config.ts'
import type { TaxInput } from './input.ts'
import type { YearConfig } from './years/2025.ts'
import type { Treaty } from './years/treaties-2025.ts'

const STUDENT_VISA_LIST: readonly string[] = [...STUDENT_VISAS.always, ...STUDENT_VISAS.askIfStudent]

export function treatyFor(input: TaxInput, cfg: YearConfig): Treaty | null {
  const code = input.person.livedBefore?.trim().toUpperCase()
  const treaty = code ? cfg.treaties[code] : undefined
  if (!treaty) return null
  const visa = input.person.visa
  if (!visa || !STUDENT_VISA_LIST.includes(visa)) return null
  return treaty
}
