// The browser's side: saved answers → FormFacts (what the forms need that the server doesn't have).
// Pure (no React, no network). The server's side, `cleanFacts`, is in clean.ts (it must not import the browser's answers).
import type { Answers } from '../flow/answers.ts'
import { daysFor, inScope, studentYearsFor } from '../residency/fromAnswers.ts'
import type { FormFacts } from './types.ts'

export function formFacts(a: Answers, year: number): FormFacts {
  const d = daysFor(a, year)
  const sy = studentYearsFor(a, year)
  return {
    visa: a.visa ?? null,
    citizenship: a.citizenship ?? null,
    days: d ? Object.fromEntries(d.working.map((w) => [String(w.year), w.days])) : {},
    daysComplete: !!d?.complete,
    studentYears: sy?.counted ?? [],
    inScope: inScope(a, year),
  }
}
