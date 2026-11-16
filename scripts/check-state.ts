// Checks the 2025 state estimates (src/tax/state.ts, stateEngine.ts, years/states-2025.ts): New York and
// California, wages only, the states with no tax on wages, and every other state.
// Run: npm run check:state
//
// Two kinds of case, labelled in the output:
//   OFFICIAL  the expected answer comes from a state's own publication (not from our code)
//   MINE      a synthetic case I made up; the expected answer is worked out by hand in the comment
import { readFileSync } from 'node:fs'
import { combined, estimateReturn, hideNumbers, isCalculated, type Estimate, type Section } from '../src/tax/estimate.ts'
import { buildTaxInput, type TaxInput } from '../src/tax/input.ts'
import { stateSection, NO_WAGE_TAX_MESSAGE, NOT_SUPPORTED_MESSAGE } from '../src/tax/state.ts'
import { caScheduleTax, caTableRow, caTax, caTaxFromTable, centicentsToDollars, nyHouseholdCredit, nyTableRow, nyTax, nyTaxFromSchedule, nyTaxFromTable } from '../src/tax/stateEngine.ts'
import { STATES_2025, type StateBracket } from '../src/tax/years/states-2025.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const { ny, ca } = STATES_2025
type Table = { source: string; columns: string[]; rows: [number, number, number, number, number][] }
const load = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/state/${name}`, import.meta.url), 'utf8')) as Table

// ---------------------------------------------------------------------------------------------
console.log('OFFICIAL: the 2025 New York State Tax Table, every printed row (fixtures/state/ny-tax-table-2025.json)\n')
const nyTable = load('ny-tax-table-2025.json')
check('the file has all 1,302 rows, without gaps, from $0 to $65,000', [nyTable.rows.length, nyTable.rows.every((r, i) => (i === 0 ? r[0] === 0 : r[0] === nyTable.rows[i - 1][1])), nyTable.rows.at(-1)![1]], [1302, true, 65_000])
check('the engine’s row boundaries match every printed row', nyTable.rows.filter((r) => { const [a, b] = nyTableRow(ny, r[0]); const [c, d] = nyTableRow(ny, r[1] - 1); return a !== r[0] || b !== r[1] || c !== r[0] || d !== r[1] }).length, 0)
check('the Single column: every row, at its first, middle and last dollar, matches New York', nyTable.rows.filter((r) => nyTaxFromTable(ny, r[0]) !== r[2] || nyTaxFromTable(ny, Math.floor((r[0] + r[1]) / 2)) !== r[2] || nyTaxFromTable(ny, r[1] - 1) !== r[2]).slice(0, 3), [])
let nyWrong = 0
for (const [lo, hi, single] of nyTable.rows) for (let x = lo; x < hi; x++) { const t = nyTax(ny, x); if (t.tax !== single || t.method !== 'table') nyWrong++ }
check('every whole dollar from $0 to $64,999 (65,000 incomes) gives the printed tax', nyWrong, 0)
check('New York’s rate schedule is used from $65,000 (the Tax Table stops below it)', [nyTax(ny, 64_999).method, nyTax(ny, 65_000).method], ['table', 'schedule'])

console.log('\nOFFICIAL: New York’s rate schedule (Instructions for Form IT-201, page 33): the printed amounts agree with the printed rates\n')
// Each bracket's printed "plus" amount must equal the previous one plus its rate on the previous bracket's width
// (rounded to whole dollars: New York prints whole dollars). Two printed numbers checking each other.
const centicentsStep = (b: StateBracket, next: StateBracket) => b.baseCents * 10_000 + b.rateBps * (next.over - b.over) * 100
check('every New York base amount = the previous base + its rate × the width (rounded to dollars)', ny.brackets.slice(0, -1).map((b, i) => centicentsToDollars(centicentsStep(b, ny.brackets[i + 1])) === ny.brackets[i + 1].baseCents / 100), ny.brackets.slice(0, -1).map(() => true))
check('the brackets join up: each starts where the last ended', ny.brackets.slice(1).every((b, i) => b.over === ny.brackets[i].upTo), true)
check('the schedule’s printed starting amounts: $13,900 → $600 (“600 plus 5.5% …”), $80,650 → $4,271, $215,400 → $12,356', [nyTaxFromSchedule(ny, 13_900), nyTaxFromSchedule(ny, 80_650), nyTaxFromSchedule(ny, 215_400)], [600, 4_271, 12_356])

console.log('\nOFFICIAL: New York household credit table 1, Single (Instructions for Form IT-201, page 12)\n')
const hh = (agi: number) => nyHouseholdCredit(ny, agi)
check('over / not over: $0 or less and up to $5,000 → $75; $5,001 to $6,000 → $60; $6,001 to $7,000 → $50', [hh(-500), hh(0), hh(5_000), hh(5_001), hh(6_000), hh(6_001), hh(7_000)], [75, 75, 75, 60, 60, 50, 50])
check('$7,001 to $20,000 → $45; $20,001 to $25,000 → $40; $25,001 to $28,000 → $20; over $28,000: no credit', [hh(7_001), hh(20_000), hh(20_001), hh(25_000), hh(25_001), hh(28_000), hh(28_001), hh(1_000_000)], [45, 45, 40, 40, 20, 20, 0, 0])

// ---------------------------------------------------------------------------------------------
console.log('\nOFFICIAL: the 2025 California Tax Table, every printed row (fixtures/state/ca-tax-table-2025.json)\n')
const caTable = load('ca-tax-table-2025.json')
check('the file has all 1,001 rows, without gaps, from $1 to $100,000', [caTable.rows.length, caTable.rows.every((r, i) => (i === 0 ? r[0] === 1 : r[0] === caTable.rows[i - 1][1] + 1)), caTable.rows.at(-1)![1]], [1001, true, 100_000])
check('the engine’s row boundaries match every printed row', caTable.rows.filter((r) => { const [a, b] = caTableRow(ca, r[0]); const [c, d] = caTableRow(ca, r[1]); return a !== r[0] || b !== r[1] || c !== r[0] || d !== r[1] }).length, 0)
check('the Single column (status 1 or 3): every row, at its first, middle and last dollar, matches California', caTable.rows.filter((r) => caTaxFromTable(ca, r[0]) !== r[2] || caTaxFromTable(ca, Math.floor((r[0] + r[1]) / 2)) !== r[2] || caTaxFromTable(ca, r[1]) !== r[2]).slice(0, 3), [])
let caWrong = 0
for (const [lo, hi, single] of caTable.rows) for (let x = lo; x <= hi; x++) { const t = caTax(ca, x); if (t.tax !== single || t.method !== 'table') caWrong++ }
check('every whole dollar from $1 to $100,000 (100,000 incomes) gives the printed tax', caWrong, 0)
check('no taxable income, no tax; $100,001 uses Schedule X', [caTax(ca, 0).tax, caTax(ca, 100_000).method, caTax(ca, 100_001).method], [0, 'table', 'schedule'])

console.log('\nOFFICIAL: California’s Schedule X (Booklet page 75) and its own worked example\n')
check('every Schedule X base amount = the previous base + its rate × the width (to the cent)', ca.brackets.slice(0, -1).map((b, i) => { const n = ca.brackets[i + 1]; return Math.floor((b.baseCents * 10_000 + b.rateBps * (n.over - b.over) * 100 + 5_000) / 10_000) === n.baseCents }), ca.brackets.slice(0, -1).map(() => true))
check('the brackets join up: each starts where the last ended', ca.brackets.slice(1).every((b, i) => b.over === ca.brackets[i].upTo), true)
// The booklet's example (page 75): Chris and Pat, Schedule Y, taxable income $125,000: 3,974.82 + 8% × 9,916 (= 793.28) = 4,768.10 → enter $4,768
const scheduleY: StateBracket[] = [{ over: 115_084, upTo: 145_448, baseCents: 397_482, rateBps: 800 }]
check('California’s own example (Schedule Y, $125,000): $4,768.10 → $4,768', caScheduleTax(scheduleY, 125_000), 4_768)
check('the tax never goes down as income goes up (every $50 from $0 to $1,000,000, both states)', (() => { let a = -1, b = -1; for (let x = 0; x <= 1_000_000; x += 50) { const n = nyTax(ny, x).tax; const c = caTax(ca, x).tax; if (n < a) return `NY ${x}`; if (c < b) return `CA ${x}`; a = n; b = c } return 'ok' })(), 'ok')

console.log('\nOFFICIAL: rounding (New York, Instructions for Form IT-201, page 2: under 50 cents down, 50 or more up)\n')
check('$1.39 → $1 and $2.50 → $3 (the examples printed there)', [centicentsToDollars(1_390_000), centicentsToDollars(2_500_000)], [1, 3])

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: New York and California estimates (worked out by hand in the comments)\n')
const wage = (state: string | null, wagesCents: number, withheldCents: number) => ({ itemId: 'opt-cpt', employer: 'Sample Employer Inc. (FAKE)', wages: wagesCents, federalWithheld: 0, stateCode: state, stateWages: wagesCents, stateWithheld: withheldCents })
const ready = buildTaxInput({ year: 2025, person: { citizenship: 'India', visa: 'F-1' }, income: ['opt-cpt'], items: [], documents: [] })
const input = (over: Partial<TaxInput> = {}): TaxInput => ({ ...ready, ...over })
const st = (over: Partial<TaxInput> = {}) => stateSection(input(over))
const line = (s: Section, id: string) => (isCalculated(s) ? (s.lines.find((l) => l.id === id)?.amount ?? NaN) : NaN)
const summary = (s: Section) => (isCalculated(s) ? [s.status, s.amount, line(s, 'state-taxable'), line(s, 'state-tax'), line(s, 'state-credit'), line(s, 'state-withheld')] : [s.status])
const D = (n: number) => n * 100

// NY, the fake W-2: wages 38,450, state withheld 1,893. Taxable 38,450 − 8,000 = 30,450 → row 30,450–30,500, middle 30,475: 600 + 5.5% × (30,475 − 13,900 = 16,575) = 911.625 → 1,511.625 → $1,512. Household credit: AGI over 28,000 → 0. Refund 1,893 − 1,512 = 381.
check('NY, the fake W-2 (wages $38,450, withheld $1,893): tax $1,512, refund $381', summary(st({ wages: [wage('NY', D(38_450), D(1_893))] })), ['refund', D(381), D(30_450), D(1_512), 0, D(1_893)])
// NY, wages 15,000, nothing withheld: taxable 7,000 → row 7,000–7,050, middle 7,025: 4% × 7,025 = 281. Household credit (AGI 7,001 to 20,000) 45 → total 236. Owes 236.
check('NY, zero withholding: wages $15,000: tax $281, household credit $45, owes $236', summary(st({ wages: [wage('NY', D(15_000), 0)] })), ['owed', D(236), D(7_000), D(281), D(45), 0])
// NY, wages 20,000, withheld 700: taxable 12,000 → row 12,000–12,050, middle 12,025: 484 + 5.25% × 325 = 17.0625 → 501.0625 → $501. Credit: AGI exactly 20,000 → 45. Total 456. Refund 700 − 456 = 244.
check('NY, a refund with the credit: wages $20,000, withheld $700: tax $501, credit $45, refund $244', summary(st({ wages: [wage('NY', D(20_000), D(700))] })), ['refund', D(244), D(12_000), D(501), D(45), D(700)])
// NY, wages 6,500, withheld 100: taxable 0 (8,000 deduction is more than the wages) → tax 0. Credit $50 (AGI 6,001 to 7,000) can't make the tax negative → 0. Refund = the 100 withheld.
check('NY, low wages: wages $6,500: no tax, the credit can’t go below zero, everything withheld comes back', summary(st({ wages: [wage('NY', D(6_500), D(100))] })), ['refund', D(100), 0, 0, 0, D(100)])
// NY, wages 75,000, withheld 3,000: taxable 67,000 (65,000 or more → the rate schedule): 600 + 5.5% × (67,000 − 13,900 = 53,100) = 2,920.50 → 3,520.50 → rounds UP to $3,521. No credit. Owes 521.
check('NY, the rate schedule: wages $75,000: 600 + 5.5% × 53,100 = $3,520.50 → $3,521 (50 cents rounds up), owes $521', summary(st({ wages: [wage('NY', D(75_000), D(3_000))] })), ['owed', D(521), D(67_000), D(3_521), 0, D(3_000)])
// NY, exactly even
check('NY, exactly even: withheld = tax → "zero"', summary(st({ wages: [wage('NY', D(38_450), D(1_512))] })), ['zero', 0, D(30_450), D(1_512), 0, D(1_512)])
check('NY, income over $107,650: no number, says why', (st({ wages: [wage('NY', D(110_000), D(5_000))] }) as { missing?: string[] }).missing, ['New York’s extra calculation for income over $107,650 isn’t built yet.'])
check('NY, $107,650 exactly is still calculated', st({ wages: [wage('NY', D(107_650), 0)] }).status, 'owed')
// CA, the fake W-2 as if in California: taxable 38,450 − 5,706 = 32,744 → row 32,651–32,750, middle 32,700.5: 414.49 + 4% × (32,700.5 − 26,264 = 6,436.5 → 257.46) = 671.95 → $672. Exemption credit 153 → 519. Refund 1,893 − 519 = 1,374.
check('CA, the fake W-2 (wages $38,450, withheld $1,893): tax $672, exemption credit $153, refund $1,374', summary(st({ wages: [wage('CA', D(38_450), D(1_893))] })), ['refund', D(1_374), D(32_744), D(672), D(153), D(1_893)])
// CA, wages 6,000: taxable 294 → row 251–350, middle 300.5: 1% × 300.5 = 3.005 → $3. Credit 153 can't go below zero → only 3 used. Total 0. Nothing withheld → zero.
check('CA, low wages: wages $6,000: tax $3, the credit takes it to zero but not below', summary(st({ wages: [wage('CA', D(6_000), 0)] })), ['zero', 0, D(294), D(3), D(3), 0])
// CA, wages 120,000, withheld 6,000: taxable 114,294 → Schedule X (over 100,000): 3,201.97 + 9.3% × (114,294 − 72,724 = 41,570 → 3,866.01) = 7,067.98 → $7,068. Credit 153 → 6,915. Owes 915.
check('CA, over $100,000 uses Schedule X: wages $120,000, withheld $6,000: tax $7,068, owes $915', summary(st({ wages: [wage('CA', D(120_000), D(6_000))] })), ['owed', D(915), D(114_294), D(7_068), D(153), D(6_000)])
check('CA, federal AGI over $252,203: no number, says why', (st({ wages: [wage('CA', D(300_000), 0)] }) as { missing?: string[] }).missing, ['California’s limit on the exemption credit for income over $252,203 isn’t built yet.'])
// CA, wages 5,706 or less: taxable 0
check('CA, wages under the standard deduction: taxable $0, no tax, all withholding comes back', summary(st({ wages: [wage('CA', D(5_000), D(50))] })), ['refund', D(50), 0, 0, 0, D(50)])

console.log('\nMINE: cents and several W-2s (cents are added first, only the totals are rounded)\n')
// two W-2s of $100.40: 200.80 → $201; state withheld 50.40 + 50.40 = 100.80 → $101
check('two W-2s in the same state: wages and withholding added first, then rounded', [line(st({ wages: [wage('NY', 10_040, 5_040), wage('NY', 10_040, 5_040)] }), 'state-wages'), line(st({ wages: [wage('NY', 10_040, 5_040), wage('NY', 10_040, 5_040)] }), 'state-withheld')], [20_100, 10_100])
check('wages $38,449.50 → $38,450 (50 cents up)', line(st({ wages: [wage('NY', 3_844_950, 0)] }), 'state-wages'), D(38_450))

console.log('\nMINE: the state comes from the W-2, always\n')
check('the W-2’s state decides, whatever the person says about where they live', [st({ wages: [wage('NY', D(38_450), D(1_893))], person: { citizenship: 'FR', visa: 'F-1', state: 'CA' } as never }).code, summary(st({ wages: [wage('NY', D(38_450), D(1_893))], person: { citizenship: 'FR', visa: 'F-1', state: 'CA' } as never }))[3]], ['NY', D(1_512)])
check('two W-2s from different states: no number, says why, no state chosen', [st({ wages: [wage('NY', D(10_000), 0), wage('CA', D(10_000), 0)] }).status, st({ wages: [wage('NY', D(10_000), 0), wage('CA', D(10_000), 0)] }).code, (st({ wages: [wage('NY', D(10_000), 0), wage('CA', D(10_000), 0)] }) as { missing: string[] }).missing], ['not-calculated', null, ['Your W-2s are from more than one state. The estimate can’t handle that yet.']])
check('a W-2 with no state ("Not on my form"): no number, says why', (st({ wages: [wage(null, D(10_000), 0)] }) as { missing: string[] }).missing, ['Your W-2 doesn’t show a state, so we can’t tell which state return applies.'])
check('no W-2 at all: no number', (st({ wages: [] }) as { missing: string[] }).missing, ['There’s no W-2 to take the state from.'])
const blockedInput = buildTaxInput({ year: 2025, person: {}, income: [], items: [{ id: 'passport', kind: 'document', label: 'Passport', status: 'missing' }], documents: [] })
check('something not confirmed yet: waits, no number (even for a no-tax state)', [st({ wages: [wage('NY', D(10_000), 0)], blockers: blockedInput.blockers }).status, st({ wages: [wage('TX', D(10_000), 0)], blockers: blockedInput.blockers }).status], ['not-calculated', 'not-calculated'])
check('a tax year with no verified figures (2024): not supported, no number', [st({ wages: [wage('NY', D(10_000), 0)], year: 2024 }).status, (st({ wages: [wage('NY', D(10_000), 0)], year: 2024 }) as { message: string }).message], ['not-supported', 'We can’t estimate this tax year yet.'])
check('income the engine can’t handle (a 1042-S) in NY: no number, says which', [st({ wages: [wage('NY', D(10_000), 0)], other: [{ itemId: 's', form: '1042-S', label: '1042-S' }] }).status, (st({ wages: [wage('NY', D(10_000), 0)], other: [{ itemId: 's', form: '1042-S', label: '1042-S' }] }) as { missing: string[] }).missing], ['not-calculated', ['We can’t include 1042-S in the estimate yet.']])

console.log('\nMINE: states with no tax on wages: the message, no number\n')
const NO_TAX = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']
check('the 2025 list is exactly these nine', STATES_2025.noWageTax.map((s) => s.code).sort(), [...NO_TAX].sort())
check('New Hampshire and Tennessee are on it (NH repealed its interest and dividends tax from 2025; TN’s Hall tax ended in 2021)', ['NH', 'TN'].map((c) => STATES_2025.noWageTax.find((s) => s.code === c)?.source.citation.includes('repealed')), [true, true])
const OFFICIAL_HOST: Record<string, string> = { AK: 'tax.alaska.gov', FL: 'floridarevenue.com', NV: 'tax.nv.gov', NH: 'revenue.nh.gov', SD: 'dor.sd.gov', TN: 'tn.gov/revenue', TX: 'comptroller.texas.gov', WA: 'dor.wa.gov', WY: 'wyo.gov' }
check('every one cites its own state’s official address, and quotes it', STATES_2025.noWageTax.map((s) => s.source.citation.includes(OFFICIAL_HOST[s.code]) && s.source.citation.includes('“')), NO_TAX.map(() => true))
check('…and, except New Hampshire, the Federation of Tax Administrators’ list (rates as of January 1, 2025)', STATES_2025.noWageTax.filter((s) => s.code !== 'NH').every((s) => s.source.citation.includes('Federation of Tax Administrators')), true)
for (const code of NO_TAX) {
  const s = st({ wages: [wage(code, D(38_450), 0)] })
  check(`${code}: “${NO_WAGE_TAX_MESSAGE}”, with no number`, [s.status, (s as { message: string }).message, s.code, /"amount"|"lines"|"withheld"/.test(JSON.stringify(s))], ['no-tax', NO_WAGE_TAX_MESSAGE, code, false])
}
check('even with income the engine can’t handle, a no-tax state is still "no state return needed"', st({ wages: [wage('TX', D(10_000), 0)], other: [{ itemId: 's', form: '1042-S', label: '1042-S' }] }).status, 'no-tax')
check('no-tax states are never part of a combined total', combined({ federal: { status: 'owed', amount: 100, lines: [], sources: [] }, state: st({ wages: [wage('TX', D(10_000), 0)] }) }), null)

console.log('\nMINE: every other state: “State return not supported yet” and what was withheld\n')
const other = st({ wages: [wage('OR', D(38_450), D(1_893))] })
check('Oregon: not supported, with the amount withheld', [other.status, (other as { message: string }).message, (other as { withheld: number }).withheld, other.code], ['not-supported', NOT_SUPPORTED_MESSAGE, D(1_893), 'OR'])
check('two W-2s in the same unsupported state: the withheld amounts are added', (st({ wages: [wage('MA', D(10_000), D(100)), wage('MA', D(10_000), D(250))] }) as { withheld: number }).withheld, D(350))
check('a state with a tax that isn’t NY or CA is never calculated (every other state and DC)', ['AL', 'AZ', 'CO', 'CT', 'DC', 'GA', 'IL', 'MA', 'NJ', 'NC', 'OH', 'OR', 'PA', 'VA'].map((c) => st({ wages: [wage(c, D(10_000), D(100))] }).status).every((x) => x === 'not-supported'), true)
check('1042-S in an unsupported state: still "not supported yet" (the state is the reason)', st({ wages: [wage('OR', D(10_000), 0)], other: [{ itemId: 's', form: '1042-S', label: '1042-S' }] }).status, 'not-supported')

console.log('\nMINE: through the whole estimate, and "Show estimate number" off\n')
const e: Estimate = estimateReturn(input({ wages: [{ ...wage('NY', D(38_450), D(1_893)), federalWithheld: D(3_186) }] }))
check('Federal and State are both calculated, and the combined total is federal + state', [e.federal.status, e.state.status, combined(e)], ['owed', 'refund', { status: 'owed', amount: D(1_193) - D(381) }])
const eTx: Estimate = estimateReturn(input({ wages: [{ ...wage('TX', D(38_450), 0), federalWithheld: D(3_186) }] }))
check('Texas: Federal calculated, State "no state return needed", no combined total', [eTx.federal.status, eTx.state.status, combined(eTx)], ['owed', 'no-tax', null])
const hidden = hideNumbers(e)
const hiddenJson = JSON.stringify(hidden.state)
check('state amounts and lines are null when the number is off', [isCalculated(hidden.state) && hidden.state.amount, isCalculated(hidden.state) && hidden.state.lines.every((l) => l.amount === null)], [null, true])
check('none of this person’s state amounts (in cents or dollars) appears anywhere in what is sent', /189300|151200|38100|3045000|38,?450|1,?512|1,?893|30,?450/.test(hiddenJson), false)
check('the labels, form lines and sources are still there', [isCalculated(hidden.state) && hidden.state.lines.length, isCalculated(hidden.state) && hidden.state.lines.every((l) => !!l.formLine && !!l.source)], [9, true])
check('an unsupported state’s withheld amount is dropped too', (hideNumbers(estimateReturn(input({ wages: [wage('OR', D(10_000), D(1_893))] }))).state as { withheld: number | null }).withheld, null)
check('no-tax: nothing to hide, nothing sent', /"amount"|"lines"/.test(JSON.stringify(hideNumbers(eTx).state)), false)
check('every NY and CA line has its form line and a publication and page', [e, estimateReturn(input({ wages: [wage('CA', D(38_450), D(1_893))] }))].every((x) => isCalculated(x.state) && x.state.lines.every((l) => !!l.formLine && /\(2025\), (page|pages) \d|2025, (page|pages) \d|Tax Table/.test(l.source ?? ''))), true)
check('"Figures used" cites a state publication for each figure', [e, estimateReturn(input({ wages: [wage('CA', D(38_450), D(1_893))] }))].map((x) => isCalculated(x.state) && x.state.sources.every((s) => /Instructions for Form IT-20|Form IT-201|Tax Table|Booklet|Form 540|IT-203/.test(s.citation))), [true, true])
check('no ID numbers or file names in the estimate', /\d{3}-\d{2}-\d{4}|\d{2}-\d{7}|X1234567|\.pdf|\.jpg|\.png/i.test(JSON.stringify(e)), false)
check('the estimate’s notes are unchanged', [...e.notes], ['Assumes single filing status.', 'Treaty benefits aren’t included yet.'])

console.log('\nMINE: answers that mean no number (married, digital assets) stop the state number too\n')
const asked = (state: string, marital: 'single' | 'married' | null, digitalAssets: 'yes' | 'no' | null) => st({ wages: [wage(state, D(38_450), D(1_893))], person: { ...ready.person, marital, digitalAssets } })
check('New York, married: no number, says why', [asked('NY', 'married', 'no').status, (asked('NY', 'married', 'no') as { missing: string[] }).missing], ['not-calculated', ['You were married at the end of 2025. The estimate only works for single filers so far.']])
check('California, digital assets Yes: no number, says why', [asked('CA', 'single', 'yes').status, (asked('CA', 'single', 'yes') as { missing: string[] }).missing], ['not-calculated', ['You received or sold digital assets in 2025. The estimate can’t include them yet.']])
check('Texas stays "no state return needed" (there is no number to withhold)', asked('TX', 'married', 'yes').status, 'no-tax')
check('Oregon stays "not supported yet", with what was withheld', [asked('OR', 'married', 'yes').status, (asked('OR', 'married', 'yes') as { withheld: number }).withheld], ['not-supported', D(1_893)])
check('single and No: New York’s refund as before ($381)', [asked('NY', 'single', 'no').status, (asked('NY', 'single', 'no') as { amount: number }).amount], ['refund', D(381)])

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll state checks passed.')
process.exit(failed ? 1 : 0)
