// Checks "Time in the U.S." (placeholder rules: src/residency.config.ts, TODO
// confirm with CPA): which questions are asked, the student-year sentence,
// and the days. Run: npm run check:residency
import type { Answers } from '../src/flow/answers.ts'
import { asksArrivalDate, asksIfStudent, asksYearAbroad, daysFor, inScope, isSupportedStudent, studentYearsFor } from '../src/residency/fromAnswers.ts'
import { STUDENT_LIMIT_YEARS } from '../src/residency.config.ts'

const TAX_YEAR = 2026
let failed = 0

/** What the person sees, as the screens would show it */
function describe(a: Answers, taxYear = TAX_YEAR) {
  const out: string[] = []
  if (asksIfStudent(a)) out.push(`asks "student?" → ${a.residency?.j1Student ?? '–'}`)
  if (!isSupportedStudent(a)) return { text: out.concat('shows "We don’t support this yet." (nothing calculated)').join(' · '), supported: false }
  out.push(`arrival year ${a.residency?.arrivalYear}`)
  out.push(asksArrivalDate(a, taxYear) ? `asks arrival date (${a.residency?.arrivalDate ?? '–'})` : 'no date question')
  out.push(asksYearAbroad(a, taxYear) ? 'asks about a full year abroad' : 'skips the year-abroad question')
  const sy = studentYearsFor(a, taxYear)!
  const scope = inScope(a, taxYear)
  out.push(`counted [${sy.counted}]${sy.notCounted.length ? ` not counted [${sy.notCounted}]` : ''}`)
  if (scope === false) return { text: out.concat('OUT OF SCOPE → stop screen "We can’t prepare your return yet" (no days asked)').join(' · '), supported: true, sy, scope }
  if (scope === null) return { text: out.concat('scope not known yet').join(' · '), supported: true, sy, scope }
  out.push(`IN SCOPE → continues · "${taxYear}: year ${sy.yearNumber} of your first ${STUDENT_LIMIT_YEARS} calendar years as a student"`)
  const d = daysFor(a, taxYear)
  if (d?.working.length) out.push('days ' + d.working.map((w) => `${w.year}: ${w.days}`).join(', '))
  if (d?.flags.length) out.push('flags: ' + d.flags.map((f) => f.kind).join(', '))
  return { text: out.join(' · '), supported: true, sy, d, scope }
}

function check(name: string, a: Answers, expect: (r: ReturnType<typeof describe>) => boolean) {
  const r = describe(a)
  const pass = expect(r)
  console.log(`${pass ? '✓' : '✗'} ${name}\n    ${r.text}`)
  if (!pass) failed++
}

const f1 = (residency: Answers['residency']): Answers => ({ visa: 'F-1', residency })

console.log('SCOPE GATE (v1: tax year within the first 5 calendar years as a student)\n')
check('Arrival 2019, no years abroad: out of scope, stop screen', f1({ arrivalYear: 2019, yearAbroad: 'no' }), (r) => r.scope === false)
check('Arrival 2019, 2020 and 2021 abroad: 2019, 2022–2025 used, 2026 is the sixth → out of scope', f1({ arrivalYear: 2019, yearAbroad: 'yes', abroadYears: [2020, 2021] }), (r) => r.scope === false && r.sy?.counted.join() === '2019,2022,2023,2024,2025,2026')
check('Arrival 2019, three full years abroad: in scope, continues', f1({ arrivalYear: 2019, yearAbroad: 'yes', abroadYears: [2020, 2021, 2022], left: 'no' }), (r) => r.scope === true && r.sy?.yearNumber === 5)
check('Arrival 2021, no years abroad: out of scope', f1({ arrivalYear: 2021, yearAbroad: 'no' }), (r) => r.scope === false)
check('Arrival 2022: in scope (2022 to 2026 is five), no year-abroad question', f1({ arrivalYear: 2022, left: 'no' }), (r) => r.scope === true && r.sy?.yearNumber === 5 && r.text.includes('skips the year-abroad'))
check('Arrival 2026: in scope', f1({ arrivalYear: 2026, arrivalDate: '2026-08-20', left: 'no' }), (r) => r.scope === true && r.sy?.yearNumber === 1)
check('Arrival 2021, year-abroad question not answered yet: not known, nothing decided', f1({ arrivalYear: 2021 }), (r) => r.scope === null)
console.log('\nDAYS (within scope)\n')
check('Arrival in the tax year: only that year, asks the date', f1({ arrivalYear: 2026, arrivalDate: '2026-08-20', left: 'no' }), (r) => r.d?.years.join() === '2026' && r.text.includes('asks arrival date') && r.d.working[0].days === 134)
check('Arrival in a Form 8843 year (2025): asks the date', f1({ arrivalYear: 2025, arrivalDate: '2025-08-15', left: 'no' }), (r) => r.text.includes('asks arrival date') && r.d?.working.map((w) => w.days).join() === '139,365')
check('Arrival before the Form 8843 years (2022): no date question', f1({ arrivalYear: 2022, left: 'no' }), (r) => r.text.includes('no date question') && r.d?.working.map((w) => w.days).join() === '366,365,365')
check('No trips: every day from arrival to year end', f1({ arrivalYear: 2024, arrivalDate: '2024-01-15', left: 'no' }), (r) => r.d?.working.map((w) => w.days).join() === '352,365,365')
check(
  'Trip spanning a year end (left Dec 20, 2025, back Jan 5, 2026): 11 days away in 2025, 4 in 2026',
  f1({ arrivalYear: 2023, left: 'yes', trips: [{ id: 't', left: '2025-12-20', back: '2026-01-05' }] }),
  (r) => r.d?.working.map((w) => w.days).join() === '366,354,361' && !r.d?.flags.length,
)
check('Trip with no return date: flagged, not guessed', f1({ arrivalYear: 2023, left: 'yes', trips: [{ id: 't', left: '2026-06-01', back: '' }] }), (r) => !!r.d?.flags.some((f) => f.kind === 'no-return') && !r.d.complete)
check('Still away (resolved): counts until the day they left', f1({ arrivalYear: 2023, left: 'yes', trips: [{ id: 't', left: '2026-06-01', back: null }] }), (r) => r.d?.working[2].days === 152 && !!r.d.complete)
check('J-1, not a student: the unsupported message', { visa: 'J-1', residency: { j1Student: 'no' } }, (r) => !r.supported)
check('J-1 student: supported', { visa: 'J-1', residency: { j1Student: 'yes', arrivalYear: 2025, arrivalDate: '2025-09-01', left: 'no' } }, (r) => r.supported)

console.log(failed ? `\n${failed} failed` : '\nAll checks pass.')
process.exit(failed ? 1 : 0)
