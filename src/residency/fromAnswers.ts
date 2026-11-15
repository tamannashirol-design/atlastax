// Turns saved answers into the working for every screen (the questions, the
// summary, Documents, Home), so they all read the same thing. Pure (no React).
import { STUDENT_VISAS } from '../residency.config.ts'
import type { Answers } from '../flow/answers.ts'
import { spanExceedsLimit, studentYears, substantialPresence, type StudentYears } from './residency.ts'
import { daysByYear, requiredDayYears, staysFromTrips, type Flag, type YearDays } from './days.ts'

/** Supported for now: F-1 and M-1, or J-1 as a student. */
export function isSupportedStudent(a: Answers): boolean {
  if (!a.visa) return false
  if ((STUDENT_VISAS.always as readonly string[]).includes(a.visa)) return true
  return (STUDENT_VISAS.askIfStudent as readonly string[]).includes(a.visa) && a.residency?.j1Student === 'yes'
}

/** Ask "Are you in the U.S. as a student?" (J-1 only). */
export const asksIfStudent = (a: Answers) => !!a.visa && (STUDENT_VISAS.askIfStudent as readonly string[]).includes(a.visa)

/** Ask the arrival date only when the arrival year is one Form 8843 asks days for. */
export const asksArrivalDate = (a: Answers, taxYear: number) => {
  const y = a.residency?.arrivalYear
  return !!y && requiredDayYears(taxYear, y).includes(y)
}

/** Ask about a full year abroad only when the span is longer than the limit (otherwise it can't change anything). */
export const asksYearAbroad = (a: Answers, taxYear: number) => {
  const y = a.residency?.arrivalYear
  return !!y && spanExceedsLimit(taxYear, y)
}

export function studentYearsFor(a: Answers, taxYear: number): StudentYears | null {
  const r = a.residency
  if (!r?.arrivalYear) return null
  return studentYears({ taxYear, arrivalYear: r.arrivalYear, abroadYears: asksYearAbroad(a, taxYear) && r.yearAbroad === 'yes' ? r.abroadYears : [] })
}

export type DaysState = {
  years: number[]
  flags: Flag[]
  working: YearDays[]
  /** Everything needed is answered and nothing is flagged */
  complete: boolean
}

export function daysFor(a: Answers, taxYear: number): DaysState | null {
  const r = a.residency
  if (!r?.arrivalYear) return null
  const years = requiredDayYears(taxYear, r.arrivalYear)
  const needsDate = asksArrivalDate(a, taxYear)
  if (needsDate && !r.arrivalDate) return { years, flags: [], working: [], complete: false }
  const start = needsDate ? r.arrivalDate! : `${years[0]}-01-01`
  const trips = r.left === 'yes' ? (r.trips ?? []) : []
  const { stays, flags } = staysFromTrips(trips, start, taxYear)
  if (r.left === 'yes' && r.historyCutOff) flags.push({ kind: 'maybe-cut-off', message: 'Your travel history may be cut off. Did you leave the U.S. earlier?' })
  const answered = r.left === 'no' || (r.left === 'yes' && trips.length > 0)
  return { years, flags, working: daysByYear(stays, years), complete: answered && flags.length === 0 }
}

/** The arithmetic shown inside "Show how we counted", only after the student limit. */
export function presenceArithmeticFor(a: Answers, taxYear: number) {
  const sy = studentYearsFor(a, taxYear)
  const days = daysFor(a, taxYear)
  if (!sy || sy.withinLimit || !days?.complete) return null
  // Days from years that were still student years don't count
  const byYear: Record<number, number> = {}
  const counted: Record<number, boolean> = {}
  for (let i = 0; i < 3; i++) {
    const y = taxYear - i
    const thatYear = studentYearsFor(a, y)
    const studentYear = !!thatYear && y >= a.residency!.arrivalYear! && thatYear.withinLimit
    counted[y] = !studentYear
    byYear[y] = studentYear ? 0 : (days.working.find((w) => w.year === y)?.days ?? 0)
  }
  return { ...substantialPresence(taxYear, byYear), counted }
}
