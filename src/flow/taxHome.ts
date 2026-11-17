// When to ask "In 2025, was your main home in the U.S. or in your home country?": ONLY with trading income AND 183 or
// more days in the U.S. in the tax year (from "Time in the U.S."). Trading gains are taxed only with 183 days or more
// (Pub 519 (2025), page 32), and then only if the gain is from U.S. sources, which for stock depends on the tax home
// (page 20). Pure (no React): the question screen (screens.tsx) and the checks both read it.
// TODO confirm with CPA: "main home" stands in for the tax home.
import { daysFor } from '../residency/fromAnswers.ts'
import type { Answers } from './answers.ts'

/** The days at which a gain can be taxed (Pub 519 (2025), page 32). Same number as src/tax/years/income-2025.ts. */
export const TAX_HOME_DAYS = 183

/** Days in the U.S. in the tax year, only when every count on "Time in the U.S." is answered (else null). */
export function daysInUS(a: Answers, year: number): number | null {
  const d = daysFor(a, year)
  return d?.complete ? (d.working.find((w) => w.year === year)?.days ?? null) : null
}

export function asksTaxHome(a: Answers, year: number): boolean {
  return !!a.income?.includes('trading') && (daysInUS(a, year) ?? 0) >= TAX_HOME_DAYS
}
