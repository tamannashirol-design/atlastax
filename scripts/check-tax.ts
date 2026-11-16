// Checks R2 (src/tax/engine.ts, federal.ts, years/2025.ts): the 2025 federal estimate.
// Run: npm run check:tax
//
// Two kinds of case, labelled in the output:
//   OFFICIAL  the expected answer comes from an IRS publication (not from our code)
//   MINE      a synthetic case I made up; the expected answer is worked out by hand in the comment
import { readFileSync } from 'node:fs'
import { federalTax, roundToDollars, taxFromTable, taxFromWorksheet, taxTableRow } from '../src/tax/engine.ts'
import { estimateReturn, hideNumbers, isCalculated, type Estimate, type Section } from '../src/tax/estimate.ts'
import { buildTaxInput, type TaxInput } from '../src/tax/input.ts'
import { YEAR_2025 } from '../src/tax/years/2025.ts'
import { yearConfig } from '../src/tax/years/index.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const cfg = YEAR_2025

// ---------------------------------------------------------------------------------------------
console.log('OFFICIAL: the 2025 Tax Table, every printed row (fixtures/irs/tax-table-2025.json)\n')
// The file holds the IRS's printed rows (Instructions for Form 1040 (2025), pages 68–79), read from
// the PDF by a script. Our engine computes the Tax Table from the rate table, so this is a real test.
type Table = { source: string; columns: string[]; rows: [number, number, number, number, number, number][] }
const table = JSON.parse(readFileSync(new URL('../fixtures/irs/tax-table-2025.json', import.meta.url), 'utf8')) as Table
check('the file has all 2,062 rows', table.rows.length, 2062)
check('the rows run without gaps from $0 to $100,000', table.rows.every((r, i) => (i === 0 ? r[0] === 0 : r[0] === table.rows[i - 1][1])) && table.rows.at(-1)![1] === 100_000, true)
check('the engine’s row boundaries match every printed row', table.rows.filter((r) => { const [lo, hi] = taxTableRow(cfg, r[0]); const [lo2, hi2] = taxTableRow(cfg, r[1] - 1); return lo !== r[0] || hi !== r[1] || lo2 !== r[0] || hi2 !== r[1] }).length, 0)
const wrongRows = table.rows.filter((r) => taxFromTable(cfg, r[0]) !== r[2] || taxFromTable(cfg, r[1] - 1) !== r[2] || taxFromTable(cfg, Math.floor((r[0] + r[1]) / 2)) !== r[2])
check('the Single column: every row, at its first, middle and last dollar, matches the IRS', wrongRows.slice(0, 3), [])
let dollarsWrong = 0
for (const [lo, hi, single] of table.rows) for (let x = lo; x < hi; x++) if (federalTax(cfg, x).tax !== single || federalTax(cfg, x).method !== 'table') dollarsWrong++
check('every whole dollar from $0 to $99,999 (100,000 incomes) gives the printed tax', dollarsWrong, 0)
check('the IRS’s own example row $25,300–25,350 (page 24 of the 1040-NR instructions) = $2,801', federalTax(cfg, 25_300).tax, 2801)

// ---------------------------------------------------------------------------------------------
console.log('\nOFFICIAL: Tax Computation Worksheet (Section A, Single) agrees with Rev. Proc. 2024-40, Table 3\n')
// The IRS publishes no worked examples for the worksheet. Two IRS publications must agree, so the
// expected values below are the "plus" amounts PRINTED in Rev. Proc. 2024-40 Table 3 (page 6) at each
// bracket edge: $17,651 at $103,350 · $40,199 at $197,300 · $57,231 at $250,525 · $188,769.75 at $626,350.
check('at $103,350 the worksheet gives $17,651 (Rev. Proc. printed base)', taxFromWorksheet(cfg, 103_350), 17_651)
check('at $197,300 the worksheet gives $40,199', taxFromWorksheet(cfg, 197_300), 40_199)
check('at $250,525 the worksheet gives $57,231', taxFromWorksheet(cfg, 250_525), 57_231)
check('at $626,350 the worksheet gives $188,769.75, rounded to $188,770', taxFromWorksheet(cfg, 626_350), 188_770)
// every worksheet row, many incomes: worksheet = Rev. Proc. formula (base + rate × excess), in exact cents
let sheetWrong = 0
let sheetTried = 0
for (let x = 100_000; x <= 1_000_000; x += 7) {
  const b = [...cfg.brackets].reverse().find((r) => x > r.over)!
  const cents = b.baseCents + b.ratePercent * (x - b.over) // dollars × percent = cents
  sheetTried++
  if (taxFromWorksheet(cfg, x) !== roundToDollars(cents)) sheetWrong++
}
check(`worksheet = Rev. Proc. formula for ${sheetTried.toLocaleString('en-US')} incomes from $100,000 to $1,000,000`, sheetWrong, 0)
check('exactly $100,000 uses the worksheet (the Tax Table stops below it)', [federalTax(cfg, 99_999).method, federalTax(cfg, 100_000).method], ['table', 'worksheet'])
check('$100,000 = $16,914 (Rev. Proc.: 5,578.50 + 22% × 51,525)', federalTax(cfg, 100_000).tax, 16_914)
check('Tax Table and worksheet meet: the tax never goes down as income goes up (every $50 from 0 to 1,000,000)', (() => { let prev = -1; for (let x = 0; x <= 1_000_000; x += 50) { const t = federalTax(cfg, x).tax; if (t < prev) return x; prev = t } return 'ok' })(), 'ok')

// ---------------------------------------------------------------------------------------------
console.log('\nOFFICIAL: rounding (Instructions for Form 1040, page 23: under 50 cents down, 50 to 99 cents up)\n')
check('$1.39 → $1', roundToDollars(139), 1)
check('$2.50 → $3 (the IRS’s own examples)', roundToDollars(250), 3)
check('49 cents rounds down, 50 cents rounds up', [roundToDollars(49), roundToDollars(50)], [0, 1])

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: the estimate from confirmed values (worked out by hand in the comments)\n')
const wage = (wagesCents: number, withheldCents: number, employer: string | null = 'Sample Employer Inc. (FAKE)') => ({ itemId: 'opt-cpt', employer, wages: wagesCents, federalWithheld: withheldCents, stateCode: 'NY', stateWages: wagesCents, stateWithheld: 189_300 })
const ready = buildTaxInput({ year: 2025, person: { citizenship: 'India', visa: 'F-1' }, income: ['opt-cpt'], items: [], documents: [] })
const input = (over: Partial<TaxInput> = {}): TaxInput => ({ ...ready, ...over })
const fed = (over: Partial<TaxInput> = {}): Section => estimateReturn(input(over)).federal
const line = (s: Section, id: string) => (isCalculated(s) ? (s.lines.find((l) => l.id === id)?.amount ?? NaN) : NaN)
const summary = (s: Section) => (isCalculated(s) ? [s.status, s.amount, line(s, 'taxable'), line(s, 'tax'), line(s, 'withheld')] : [s.status])

// the fake W-2: wages 38,450 → row 38,450–38,500, middle 38,475: 1,192.50 + 12% × 26,550 = 1,192.50 + 3,186 = 4,378.50 → $4,379. Withheld 3,186 → owes 1,193.
check('the fake W-2 (wages $38,450, withheld $3,186): tax $4,379, owes $1,193', summary(fed({ wages: [wage(3_845_000, 318_600)] })), ['owed', 119_300, 3_845_000, 437_900, 318_600])
// wages 20,000 → row 20,000–20,050, middle 20,025: 1,192.50 + 12% × 8,100 = 2,164.50 → $2,165. Withheld 2,500 → refund 335.
check('a refund: wages $20,000, withheld $2,500: tax $2,165, refund $335', summary(fed({ wages: [wage(2_000_000, 250_000)] })), ['refund', 33_500, 2_000_000, 216_500, 250_000])
// wages 15,000 → row 15,000–15,050, middle 15,025: 1,192.50 + 12% × 3,100 = 1,564.50 → $1,565. Nothing withheld → owes 1,565.
check('zero withholding: wages $15,000, withheld $0: owes $1,565', summary(fed({ wages: [wage(1_500_000, 0)] })), ['owed', 156_500, 1_500_000, 156_500, 0])
check('exactly even: withheld = tax → "zero", amount 0', summary(fed({ wages: [wage(2_000_000, 216_500)] })), ['zero', 0, 2_000_000, 216_500, 216_500])
// wages 0 → tax 0 (row 0–5), withheld 500 → refund 500
check('no wages but tax withheld: tax $0, the whole amount comes back', summary(fed({ wages: [wage(0, 50_000)] })), ['refund', 50_000, 0, 0, 50_000])
// wages 120,000 → worksheet row 103,350–197,300: 24% × 120,000 − 7,153 = 21,647. Withheld 20,000 → owes 1,647.
check('$100,000 or more uses the worksheet: wages $120,000, withheld $20,000: tax $21,647, owes $1,647', summary(fed({ wages: [wage(12_000_000, 2_000_000)] })), ['owed', 164_700, 12_000_000, 2_164_700, 2_000_000])
check('…and says so, with the worksheet’s IRS page', isCalculated(fed({ wages: [wage(12_000_000, 0)] })) && (fed({ wages: [wage(12_000_000, 0)] }) as { lines: { id: string; source?: string }[] }).lines.find((l) => l.id === 'tax')?.source, 'Instructions for Form 1040 (2025), page 80')

console.log('\nMINE: cents and several W-2s (cents are added first, only the totals are rounded)\n')
check('wages $38,449.50 → $38,450 (50 cents rounds up)', line(fed({ wages: [wage(3_844_950, 0)] }), 'wages'), 3_845_000)
check('wages $38,449.49 → $38,449', line(fed({ wages: [wage(3_844_949, 0)] }), 'wages'), 3_844_900)
// 100.40 + 100.40 = 200.80 → $201 (rounding each first would give $200)
check('two W-2s of $100.40: added first ($200.80) → $201, not $200', line(fed({ wages: [wage(10_040, 0), wage(10_040, 0)] }), 'wages'), 20_100)
check('two W-2s, withheld $50.40 + $50.40 → $101', line(fed({ wages: [wage(100_000, 5_040), wage(100_000, 5_040)] }), 'withheld'), 10_100)
check('the lines add up: result = |withheld − tax|, taxable = income − deductions', (() => { const s = fed({ wages: [wage(3_845_000, 318_600)] }); return [line(s, 'result') === Math.abs(line(s, 'withheld') - line(s, 'tax')), line(s, 'taxable') === line(s, 'total-income') - line(s, 'deduction')] })(), [true, true])
check('deductions are $0 and say "Not included yet"', (() => { const s = fed({ wages: [wage(3_845_000, 318_600)] }) as { lines: { id: string; amount: number; from?: string }[] }; const d = s.lines.find((l) => l.id === 'deduction')!; return [d.amount, d.from] })(), [0, 'Not included yet'])
check('every line has its form line and an IRS publication and page', (fed({ wages: [wage(3_845_000, 318_600)] }) as { lines: { formLine?: string; source?: string }[] }).lines.every((l) => !!l.formLine && /\(2025\), (page|pages) \d/.test(l.source ?? '')), true)
check('"Figures used" lists the sources, each with a publication', (fed({ wages: [wage(3_845_000, 318_600)] }) as { sources: { citation: string }[] }).sources.every((s) => /Form 1040|Rev\. Proc\./.test(s.citation)), true)

console.log('\nMINE: no number, and a clear message (the engine never guesses)\n')
const noNumber = (s: Section) => !isCalculated(s) && !/"amount"|"lines"/.test(JSON.stringify(s))
const w = [wage(3_845_000, 318_600)]
const scholarship = fed({ wages: w, other: [{ itemId: 'scholarship', form: '1042-S', label: '1042-S' }] })
check('a 1042-S (scholarship): no number, says which', [scholarship.status, noNumber(scholarship), (scholarship as { missing: string[] }).missing], ['not-calculated', true, ['We can’t include 1042-S in the estimate yet.']])
const freelance = fed({ wages: w, other: [{ itemId: 'freelance', form: null, label: 'Freelance income' }] })
check('freelance income (no form): no number, says which', [freelance.status, noNumber(freelance), (freelance as { missing: string[] }).missing], ['not-calculated', true, ['We can’t include Freelance income in the estimate yet.']])
check('two kinds of income it can’t handle: each named once', (fed({ wages: w, other: [{ itemId: 'a', form: '1099-B', label: '1099-B' }, { itemId: 'b', form: '1099-B', label: '1099-B' }, { itemId: 'c', form: null, label: 'Trading' }] }) as { missing: string[] }).missing, ['We can’t include 1099-B in the estimate yet.', 'We can’t include Trading in the estimate yet.'])
check('no W-2 at all: no number', (fed({ wages: [] }) as { missing: string[] }).missing, ['There’s no W-2 to calculate from.'])
const blockedInput = buildTaxInput({ year: 2025, person: {}, income: [], items: [{ id: 'passport', kind: 'document', label: 'Passport', status: 'missing' }], documents: [] })
check('something not confirmed yet (R1 blockers): waits, no number, blockers pass through', (e => [(e.federal as { missing: string[] }).missing, noNumber(e.federal), e.blockers.length > 0])(estimateReturn({ ...blockedInput, wages: w })), [['Waiting for the items listed above.'], true, true])
check('blockers win over everything else (no number even with good wages)', fed({ wages: w, blockers: blockedInput.blockers }).status, 'not-calculated')
check('a tax year with no verified figures (2024): not supported, no number', [fed({ wages: w, year: 2024 }).status, noNumber(fed({ wages: w, year: 2024 })), (fed({ wages: w, year: 2024 }) as { message: string }).message], ['not-supported', true, 'We can’t estimate this tax year yet.'])
check('only years with final IRS figures are configured', [yearConfig(2025)?.year, yearConfig(2024), yearConfig(2023), yearConfig(2026)], [2025, null, null, null])
check('the engine refuses cents or negative taxable income (callers must round first)', [(() => { try { federalTax(cfg, 100.5); return 'ran' } catch { return 'refused' } })(), (() => { try { federalTax(cfg, -1); return 'ran' } catch { return 'refused' } })()], ['refused', 'refused'])

console.log('\nMINE: the state is figured by src/tax/state.ts (tested by check:state); notes unchanged\n')
const e: Estimate = estimateReturn(input({ wages: w }))
// the W-2 here says New York with $1,893 withheld: see check:state for the figures
check('state: calculated from the W-2’s state (New York)', [e.state.status, e.state.code], ['refund', 'NY'])
check('both sections are calculated, so there is a combined total', [isCalculated(e.federal), isCalculated(e.state)], [true, true])
check('notes: single filing status and treaty benefits', [...e.notes], ['Assumes single filing status.', 'Treaty benefits aren’t included yet.'])

console.log('\nMINE: "Show estimate number" off removes every amount\n')
const hidden = hideNumbers(estimateReturn(input({ wages: w })))
const hiddenJson = JSON.stringify(hidden)
check('headline and every line amount are null', [isCalculated(hidden.federal) && hidden.federal.amount, isCalculated(hidden.federal) && hidden.federal.lines.every((l) => l.amount === null)], [null, true])
check('none of this person’s amounts (wages, tax, withheld, result, in cents or dollars) appears anywhere in what is sent', /3845000|437900|318600|119300|38,?450|4,?379|3,?186|1,?193/.test(hiddenJson), false)
check('the labels, form lines and IRS sources are still there', [hidden.numbersHidden, isCalculated(hidden.federal) && hidden.federal.lines.length, isCalculated(hidden.federal) && hidden.federal.lines.every((l) => !!l.source)], [true, 7, true])
const shown = JSON.stringify(estimateReturn(input({ wages: w })))
check('no ID numbers or file names in the estimate (SSN, EIN, passport shapes)', /\d{3}-\d{2}-\d{4}|\d{2}-\d{7}|X1234567|\.pdf|\.jpg|\.png/i.test(shown), false)

console.log('\nMINE: answers that mean no number (src/tax/stops.ts)\n')
const withPerson = (marital: 'single' | 'married' | null, digitalAssets: 'yes' | 'no' | null) => estimateReturn(input({ wages: [wage(3_845_000, 318_600)], person: { ...ready.person, marital, digitalAssets } }))
const MARRIED = 'You were married at the end of 2025. The estimate only works for single filers so far.'
const CRYPTO = 'You received or sold digital assets in 2025. The estimate can’t include them yet.'
check('married: no federal number, and it says why', [withPerson('married', 'no').federal.status, (withPerson('married', 'no').federal as { missing: string[] }).missing, /"amount"/.test(JSON.stringify(withPerson('married', 'no').federal))], ['not-calculated', [MARRIED], false])
check('digital assets Yes: no federal number, and it says why', [withPerson('single', 'yes').federal.status, (withPerson('single', 'yes').federal as { missing: string[] }).missing], ['not-calculated', [CRYPTO]])
check('both: both reasons', (withPerson('married', 'yes').federal as { missing: string[] }).missing, [MARRIED, CRYPTO])
check('single and No: the number as before ($1,193 owed); not answered (an older session): the same', [withPerson('single', 'no').federal.status, (withPerson('single', 'no').federal as { amount: number }).amount, (withPerson(null, null).federal as { amount: number }).amount], ['owed', 119_300, 119_300])
check('something unconfirmed AND married: waits, and still says why', (estimateReturn({ ...blockedInput, person: { ...ready.person, marital: 'married', digitalAssets: null }, wages: w }).federal as { missing: string[] }).missing, ['Waiting for the items listed above.', MARRIED])

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll tax checks passed.')
process.exit(failed ? 1 : 0)
