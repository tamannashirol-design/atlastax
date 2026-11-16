// Checks /result's rules (src/tax/estimate.ts) and its test inputs (src/tax/fixtures.ts).
// Run: npm run check:result. The sample numbers are mine, labelled TEST on screen; this
// only proves they add up and that nothing is ever invented.
import { combined, estimateReturn, hideNumbers, isCalculated, RESULT_NOTES, type Estimate, type Section } from '../src/tax/estimate.ts'
import { RESULT_SAMPLES } from '../src/tax/fixtures.ts'
import { RESULT_FIXTURES } from '../src/tax/fixtureNames.ts'
import { buildTaxInput } from '../src/tax/input.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const calc = (status: 'refund' | 'owed' | 'zero', amount: number | null): Section => ({ status, amount, lines: [], sources: [] })
const wait: Section = { status: 'not-calculated', missing: ['x'] }
const withState = (s: Section) => ({ ...s, code: 'NY' as string | null }) as Estimate['state']

console.log('NOTHING IS INVENTED (the state has no engine yet; federal says no when it can’t)\n')
const stubIn = buildTaxInput({ year: 2025, person: {}, income: [], items: [], documents: [] })
const w2 = { itemId: 'w', employer: null, wages: 3_845_000, federalWithheld: 318_600, stateCode: 'NY', stateWages: 3_845_000, stateWithheld: 189_300 }
const stub = estimateReturn({ ...stubIn, wages: [w2] })
const unsupported = estimateReturn({ ...stubIn, wages: [w2], other: [{ itemId: 's', form: '1042-S', label: '1042-S' }] })
check('state says "not calculated" with what’s missing (federal is calculated: R2)', [stub.federal.status, stub.state.status, (stub.state as { missing: string[] }).missing], ['owed', 'not-calculated', ['The state calculation isn’t built yet.']])
check('no amount anywhere in the state section', /"amount"|"lines"/.test(JSON.stringify(stub.state)), false)
check('income the federal engine can’t handle: "not calculated", no amount anywhere', [unsupported.federal.status, /"amount"|"lines"/.test(JSON.stringify(unsupported.federal))], ['not-calculated', false])
check('the state comes from the W-2', stub.state.code, 'NY')
check('blockers from R1 pass through, and sections say they are waiting', (({ blockers, federal }) => [blockers.length > 0, (federal as { missing: string[] }).missing[0]])(estimateReturn(buildTaxInput({ year: 2025, person: {}, income: [], items: [{ id: 'passport', kind: 'document', label: 'Passport', status: 'missing' }], documents: [] }))), [true, 'Waiting for the items listed above.'])
check('notes: single filing status and treaty benefits', [...stub.notes], ['Assumes single filing status.', 'Treaty benefits aren’t included yet.'])
check('both forms are "not ready" until they are built', stub.forms.map((f) => [f.id, f.status]), [['form-8843', 'not-ready'], ['form-1040nr', 'not-ready']])
check('RESULT_NOTES is what the page shows', [...RESULT_NOTES], stub.notes)

console.log('\nCOMBINED TOTAL (only when both are calculated)\n')
check('both refunds add up', combined({ federal: calc('refund', 40700), state: withState(calc('refund', 12000)) }), { status: 'refund', amount: 52700 })
check('both owed add up', combined({ federal: calc('owed', 59300), state: withState(calc('owed', 8500)) }), { status: 'owed', amount: 67800 })
check('a refund and an amount owed net out', combined({ federal: calc('refund', 40700), state: withState(calc('owed', 50700)) }), { status: 'owed', amount: 10000 })
check('exactly even → zero', combined({ federal: calc('refund', 5000), state: withState(calc('owed', 5000)) }), { status: 'zero', amount: 0 })
check('federal calculated, state not → no combined total', combined({ federal: calc('refund', 100), state: withState(wait) }), null)
check('state calculated, federal not → no combined total', combined({ federal: wait, state: withState(calc('owed', 100)) }), null)
check('not supported → no combined total', combined({ federal: calc('refund', 100), state: withState({ status: 'not-supported', message: 'x' }) }), null)
check('numbers hidden → no combined total', combined({ federal: calc('refund', null), state: withState(calc('refund', null)) }), null)

console.log('\n"SHOW ESTIMATE NUMBER" OFF (also on the server: no amount is sent)\n')
const hidden = hideNumbers(RESULT_SAMPLES.owed)
check('headline and every line amount are gone', [isCalculated(hidden.federal) && hidden.federal.amount, isCalculated(hidden.federal) && hidden.federal.lines.every((l) => l.amount === null), isCalculated(hidden.state) && hidden.state.amount], [null, true, null])
check('no digit of any sample amount remains in the hidden estimate', /3845000|377900|318600|59300|189300|197800|8500/.test(JSON.stringify(hidden)), false)
check('it says numbers are hidden; the states and labels still work', [hidden.numbersHidden, hidden.federal.status, hidden.notes.length], [true, 'owed', 2])
check('not-supported keeps its message, drops the withheld amount', hideNumbers({ ...stub, state: { code: 'TX', status: 'not-supported', message: 'State return not supported yet', withheld: 5000 } }).state, { code: 'TX', status: 'not-supported', message: 'State return not supported yet', withheld: null })

console.log('\nTEST INPUTS (/result?result=…) ADD UP\n')
const line = (s: Section, id: string) => (isCalculated(s) ? (s.lines.find((l) => l.id === id)?.amount ?? NaN) : NaN)
for (const name of ['refund', 'owed'] as const) {
  const e = RESULT_SAMPLES[name]
  const fed = e.federal
  const st = e.state
  if (!isCalculated(fed) || !isCalculated(st)) { check(`${name}: both calculated`, false, true); continue }
  const fedDiff = line(fed, 'withheld') - line(fed, 'tax')
  const stDiff = line(st, 'state-withheld') - line(st, 'state-tax')
  check(`${name}: federal result = withheld − tax`, [fed.status, fed.amount, Math.abs(fedDiff)], [fedDiff > 0 ? 'refund' : 'owed', Math.abs(fedDiff), Math.abs(fedDiff)])
  check(`${name}: state result = withheld − tax`, [st.status, st.amount, Math.abs(stDiff)], [stDiff > 0 ? 'refund' : 'owed', Math.abs(stDiff), Math.abs(stDiff)])
  check(`${name}: taxable income = income − deduction`, line(fed, 'taxable'), line(fed, 'total-income') - line(fed, 'deduction'))
  check(`${name}: every line says it is a test input`, [...fed.lines, ...st.lines].every((l) => l.from === 'Test input'), true)
}
check('refund sample: federal $407, state $120, together $527', [RESULT_SAMPLES.refund.federal, RESULT_SAMPLES.refund.state].map((s) => isCalculated(s) && s.amount).concat([combined(RESULT_SAMPLES.refund)?.amount]), [40700, 12000, 52700])
check('owed sample: federal $593, state $85, together $678', [RESULT_SAMPLES.owed.federal, RESULT_SAMPLES.owed.state].map((s) => isCalculated(s) && s.amount).concat([combined(RESULT_SAMPLES.owed)?.amount]), [59300, 8500, 67800])
check('blocked sample has blockers with a place to fix each', RESULT_SAMPLES.blocked.blockers.every((b) => b.fix.target.path === '/review'), true)
check('waiting sample has no blockers and nothing calculated', [RESULT_SAMPLES.waiting.blockers.length, isCalculated(RESULT_SAMPLES.waiting.federal)], [0, false])
check('a sample for every name', RESULT_FIXTURES.every((n) => n in RESULT_SAMPLES), true)

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
