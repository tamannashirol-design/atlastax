// Which tax years have a verified configuration. A year not listed here gets no estimate.
import { YEAR_2025, type YearConfig } from './2025.ts'

const YEARS: Record<number, YearConfig> = { 2025: YEAR_2025 }

export const yearConfig = (year: number): YearConfig | null => {
  const c = YEARS[year]
  return c && c.status === 'final' ? c : null
}
