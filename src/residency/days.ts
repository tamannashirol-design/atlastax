// Days in the U.S. from trips abroad. Pure (no React); rules in src/residency.config.ts.
// The person lists the trips they took OUT of the U.S.; days in the U.S. are
// the days of each year minus the days abroad. Internally the trips are
// inverted into stays in the U.S. and counted as a set of dates, so no date
// is counted twice. Never guesses: anything that doesn't add up becomes a flag.
import { CBP_HISTORY_ROW_LIMIT, DAY_COUNTING, FORM_8843_DAY_YEARS } from '../residency.config.ts'

/** A trip out of the U.S. Dates are YYYY-MM-DD; "" = not filled in yet; back null = still away. */
export type AbroadTrip = { id: string; left: string; back: string | null; fromHistory?: boolean }
/** A stay in the U.S. (exit null = through Dec 31) */
export type Stay = { entry: string; exit: string | null }

export type FlagKind = 'no-return' | 'no-leave' | 'back-before-left' | 'overlap' | 'before-arrival' | 'maybe-cut-off'
export type Flag = { kind: FlagKind; tripId?: string; message: string }

export const FLAG_MESSAGES: Record<FlagKind, string> = {
  'no-return': 'We couldn’t find when you came back. Are you still outside the U.S.?',
  'no-leave': 'We couldn’t find when you left for this trip. Add the date you left.',
  'back-before-left': 'You came back before you left. Check the dates.',
  overlap: 'This trip overlaps another one. Check the dates.',
  'before-arrival': 'This trip starts before you arrived. Check the dates.',
  'maybe-cut-off': 'Your travel history may be cut off. Did you leave the U.S. earlier?',
}

const DAY = 86_400_000
const toTime = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
const toDate = (t: number) => new Date(t).toISOString().slice(0, 10)

/** Years Form 8843 asks days for: the tax year and the 2 before it, never before the arrival year. */
export function requiredDayYears(taxYear: number, arrivalYear: number): number[] {
  const out: number[] = []
  for (let y = Math.max(arrivalYear, taxYear - FORM_8843_DAY_YEARS + 1); y <= taxYear; y++) out.push(y)
  return out
}

/**
 * Turn trips abroad into stays in the U.S., from `start` (the arrival date,
 * or Jan 1 of the first year asked) to Dec 31 of the tax year.
 */
export function staysFromTrips(trips: AbroadTrip[], start: string, taxYear: number): { stays: Stay[]; flags: Flag[] } {
  const flags: Flag[] = []
  const flag = (kind: FlagKind, tripId?: string) => flags.push({ kind, tripId, message: FLAG_MESSAGES[kind] })
  const filled = [...trips].sort((a, b) => (a.left || '9999').localeCompare(b.left || '9999'))
  const stays: Stay[] = []
  let cursor: string | null = start
  let lastBack = ''
  for (const t of filled) {
    if (!t.left) {
      flag('no-leave', t.id)
      continue
    }
    if (t.left < start) flag('before-arrival', t.id)
    if (t.back && t.back < t.left) flag('back-before-left', t.id)
    if (lastBack && t.left < lastBack) flag('overlap', t.id)
    if (t.back === '') flag('no-return', t.id)
    if (cursor !== null && t.left >= cursor) {
      // In the U.S. from the cursor through the day they left (that day counts as in the U.S.)
      const leave = DAY_COUNTING.leaveDayInUS ? t.left : toDate(toTime(t.left) - DAY)
      stays.push({ entry: cursor, exit: leave })
    }
    if (t.back === null || t.back === '') {
      cursor = null // still away (or unknown): nothing more counted
      break
    }
    cursor = DAY_COUNTING.returnDayInUS ? t.back : toDate(toTime(t.back) + DAY)
    lastBack = t.back
  }
  if (cursor !== null) stays.push({ entry: cursor, exit: `${taxYear}-12-31` })
  return { stays, flags }
}

export type YearDays = { year: number; days: number; daysInYear: number; stays: { from: string; to: string; days: number }[] }

/** Days in the U.S. per calendar year, counting dates as a set (a date never counts twice). */
export function daysByYear(stays: Stay[], years: number[]): YearDays[] {
  return years.map((year) => {
    const start = Date.UTC(year, 0, 1)
    const end = Date.UTC(year, 11, 31)
    const dates = new Set<number>()
    const parts: YearDays['stays'] = []
    for (const s of stays) {
      const from = Math.max(toTime(s.entry), start)
      const to = Math.min(s.exit ? toTime(s.exit) : end, end)
      if (to < from) continue
      let n = 0
      for (let d = from; d <= to; d += DAY) {
        if (!dates.has(d)) n++
        dates.add(d)
      }
      parts.push({ from: toDate(from), to: toDate(to), days: n })
    }
    return { year, days: dates.size, daysInYear: Math.round((end - start) / DAY) + 1, stays: parts }
  })
}

/** A CBP travel history row (only dates matter). */
export type TravelRow = { date: string; kind: 'arrival' | 'departure' }

/** Read a travel history into trips abroad: each departure, then the next arrival. Flags anything unpaired. */
export function tripsFromTravelHistory(rows: TravelRow[], arrivalYear: number): { trips: AbroadTrip[]; cutOff: boolean } {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const trips: AbroadTrip[] = []
  let n = 0
  let away: AbroadTrip | null = null
  sorted.forEach((r, i) => {
    if (r.kind === 'departure') {
      away = { id: `h${n++}`, left: r.date, back: '', fromHistory: true }
      trips.push(away)
    } else if (away) {
      away.back = r.date
      away = null
    } else if (i > 0) {
      // An arrival with no departure before it (not the first arrival): the departure is missing
      trips.push({ id: `h${n++}`, left: '', back: r.date, fromHistory: true })
    }
  })
  const earliest = sorted[0]
  const cutOff = (!!earliest && Number(earliest.date.slice(0, 4)) > arrivalYear) || rows.length >= CBP_HISTORY_ROW_LIMIT
  return { trips, cutOff }
}

/** Stub extraction: real reading (OCR) comes later. Sample rows shaped like a CBP travel history. */
export function extractTravelHistoryStub(arrivalYear: number, taxYear: number): TravelRow[] {
  const rows: TravelRow[] = [{ date: `${arrivalYear}-08-14`, kind: 'arrival' }]
  for (let y = Math.max(arrivalYear, taxYear - 2); y < taxYear; y++) {
    rows.push({ date: `${y}-12-18`, kind: 'departure' }, { date: `${y + 1}-01-09`, kind: 'arrival' })
  }
  return rows
}
