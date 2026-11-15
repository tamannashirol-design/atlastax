// Student years: which calendar years count toward the student limit.
// Pure (no React); rules in src/residency.config.ts. It returns the working,
// never a filing status.
import { STUDENT_LIMIT_YEARS } from '../residency.config.ts'

export type StudentInput = { taxYear: number; arrivalYear: number; /** Full calendar years with no time in the U.S. */ abroadYears?: number[] }

export type StudentYears = {
  /** Calendar years from the arrival year to the tax year */
  span: number
  counted: number[]
  notCounted: number[]
  /** Student years used before the tax year */
  usedBefore: number
  /** Within the first STUDENT_LIMIT_YEARS: the tax year is still a student year (the v1 scope) */
  withinLimit: boolean
  /** Which student year the tax year is (1-based), when within the limit */
  yearNumber: number
}

/** Does the year-abroad question matter? Only when the span is longer than the limit (otherwise the answer can't change anything). */
export const spanExceedsLimit = (taxYear: number, arrivalYear: number) => taxYear - arrivalYear + 1 > STUDENT_LIMIT_YEARS

export function studentYears({ taxYear, arrivalYear, abroadYears = [] }: StudentInput): StudentYears {
  const counted: number[] = []
  const notCounted: number[] = []
  for (let y = arrivalYear; y <= taxYear; y++) {
    // The arrival year always counts (they arrived); a full year abroad doesn't
    if (y !== arrivalYear && abroadYears.includes(y)) notCounted.push(y)
    else counted.push(y)
  }
  const usedBefore = counted.filter((y) => y < taxYear).length
  return {
    span: taxYear - arrivalYear + 1,
    counted,
    notCounted,
    usedBefore,
    withinLimit: usedBefore < STUDENT_LIMIT_YEARS,
    yearNumber: usedBefore + 1,
  }
}
