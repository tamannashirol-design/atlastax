// Checks R1 (src/tax/input.ts): confirmed Review values → tax input.
// ALL cases here are synthetic (mine), not from an IRS source: R1 is bookkeeping, not tax math.
// Run: npm run check:taxinput
import { FIELDS } from '../src/extraction.config.ts'
import { buildTaxInput, toCents, type ConfirmedDocument, type ConfirmedField, type TaxItem } from '../src/tax/input.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}

const f = (value: string, o: Partial<ConfirmedField> = {}): ConfirmedField => ({ value, ticked: true, notOnForm: false, confidence: 'high', ...o })
const w2Fields = (o: Record<string, ConfirmedField> = {}): Record<string, ConfirmedField> => ({
  employeeTaxId: f('123-45-6789'),
  employeeAddress: f('123 Sample St Apt 4B, New York, NY 10001'),
  employerName: f('Sample Employer Inc. (FAKE)'),
  employerEin: f('12-3456789'),
  wages: f('38,450.00'),
  federalWithheld: f('3186.00', { confidence: 'low' }),
  state: f('NY'),
  stateWages: f('38450.00'),
  stateWithheld: f('1893.00'),
  ...o,
})
const doc = (itemId: string, form: ConfirmedDocument['form'], fields: Record<string, ConfirmedField>, status: ConfirmedDocument['status'] = 'confirmed'): ConfirmedDocument => ({ itemId, form, status, fields })
const passport = doc('passport', 'Passport', { firstName: f('SAMPLE'), lastName: f('PERSON'), passportNumber: f('X1234567'), country: f('Sample Country'), dateOfBirth: f('2000-01-01'), expires: f('2031-01-01') })
const i94 = doc('i94', 'I-94', { admissionNumber: f('12345678901'), classOfAdmission: f('F1'), mostRecentEntry: f('2025-08-15') })
const item = (id: string, label: string, status = 'added', extra: Partial<TaxItem> = {}): TaxItem => ({ id, kind: 'document', label, status, ...extra })
const items = [item('passport', 'Passport'), item('i94', 'Most recent I-94'), item('opt-cpt', 'W-2')]
const build = (docs: ConfirmedDocument[], its = items, income = ['opt-cpt']) => buildTaxInput({ year: 2025, person: { citizenship: 'IN', visa: 'F-1' }, income, items: its, documents: docs })
const good = [passport, i94, doc('opt-cpt', 'W-2', w2Fields())]

console.log('MONEY TEXT → CENTS\n')
check('plain, with commas, with one decimal', [toCents('100'), toCents('24,180.00'), toCents('0.1'), toCents('1,000')], [10000, 2418000, 10, 100000])
check('not an amount → null', ['', 'abc', '1.234', '-5', '12,34', '$5', '1e3', '1,00'].map(toCents), [null, null, null, null, null, null, null, null])

console.log('\nA COMPLETE, CONFIRMED RETURN\n')
const ready = build(good)
check('no blockers', ready.blockers, [])
check('the W-2 becomes wage input, in cents', ready.wages, [{ itemId: 'opt-cpt', employer: 'Sample Employer Inc. (FAKE)', wages: 3845000, federalWithheld: 318600, stateCode: 'NY', stateWages: 3845000, stateWithheld: 189300 }])
check('person, year, filing status, assumption', [ready.year, ready.filingStatus, ready.person, ready.assumptions], [2025, 'single', { citizenship: 'IN', visa: 'F-1', livedBefore: null, marital: null, digitalAssets: null, daysInUS: null }, ['Filing status: single (we don’t ask yet).']])
check('output holds NO ID numbers (SSN, EIN, passport, admission number)', /123-45-6789|12-3456789|X1234567|12345678901|\d{3}-\d{2}-\d{4}|\d{2}-\d{7}/.test(JSON.stringify(ready)), false)
check('two W-2s → two wage entries', build([...good, doc('on-campus-job', 'W-2', w2Fields({ wages: f('5000.00') }))], [...items, item('on-campus-job', 'W-2')], ['opt-cpt', 'on-campus-job']).wages.map((w) => w.wages), [3845000, 500000])

console.log('\nONLY CONFIRMED VALUES GO IN\n')
const unticked = build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ wages: f('38450.00', { ticked: false }) }))])
check('an unticked amount is never used (no wage entry)', unticked.wages, [])
check('…it is a blocker that goes to that document on Review', unticked.blockers.map((b) => [b.id, b.fix.target]), [['opt-cpt:wages:unticked', { path: '/review', state: { doc: 'opt-cpt' } }]])
check('the state needs its tick too (it picks the state return)', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ state: f('NY', { ticked: false }) }))]).blockers.map((b) => b.id), ['opt-cpt:state:unticked'])
check('a plain detail marked "Please check" needs its tick', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ employerName: f('Sample Employer Inc. (FAKE)', { confidence: 'low', ticked: false }) }))]).blockers.map((b) => b.id), ['opt-cpt:employerName:unticked'])
check('a plain, clear detail needs no tick (confirmed by the document)', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ employerName: f('Sample Employer Inc. (FAKE)', { ticked: false }) }))]).blockers, [])
check('a value that needs a tick is not used even when other fields are fine', unticked.wages.length, 0)

console.log('\nDOCUMENTS MUST BE ADDED AND CONFIRMED\n')
check('document still open → blocker to its Review screen', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields(), 'open')]).blockers.map((b) => b.id), ['opt-cpt:unconfirmed'])
check('document skipped → blocker', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields(), 'skipped')]).blockers.map((b) => b.id), ['opt-cpt:unconfirmed'])
check('document with no review at all → blocker', build([passport, i94]).blockers.map((b) => b.id), ['opt-cpt:unconfirmed'])
check('passport and I-94 must be confirmed too', build([doc('passport', 'Passport', passport.fields, 'open'), i94, doc('opt-cpt', 'W-2', w2Fields())]).blockers.map((b) => b.id), ['passport:unconfirmed'])
check('required document not added (later / none / missing) → blocker to Documents', ['later', 'none', 'missing'].map((s) => build([passport, i94], [...items.slice(0, 2), item('opt-cpt', 'W-2', s)]).blockers.map((b) => [b.id, b.fix.target.path])), [[['opt-cpt:missing', '/documents#item-opt-cpt']], [['opt-cpt:missing', '/documents#item-opt-cpt']], [['opt-cpt:missing', '/documents#item-opt-cpt']]])
check('optional documents (state ID) never block', build(good, [...items, item('state-id', 'Driver’s license or state ID', 'missing', { optional: true })]).blockers, [])

console.log('\nAMOUNTS MUST BE VALID, NEVER GUESSED\n')
check('"12,34" is not an amount → blocker, no wage entry', (({ blockers, wages }) => [blockers.map((b) => b.id), wages.length])(build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ wages: f('12,34') }))])), [['opt-cpt:wages:invalid'], 0])
check('three decimals → blocker (never rounded)', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ federalWithheld: f('1.234') }))]).blockers.map((b) => b.id), ['opt-cpt:federalWithheld:invalid'])

console.log('\n"NOT ON MY FORM" (only where the field may be blank, only when chosen)\n')
const noStateTax = build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ stateWithheld: f('', { notOnForm: true, ticked: false }), stateWages: f('', { notOnForm: true, ticked: false }), state: f('', { notOnForm: true, ticked: false }) }))])
check('state boxes "Not on my form" → zero and no state', [noStateTax.blockers, noStateTax.wages[0].stateWithheld, noStateTax.wages[0].stateWages, noStateTax.wages[0].stateCode], [[], 0, 0, null])
check('wages can’t be "Not on my form" (the form must have them) → missing', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ wages: f('', { notOnForm: true, ticked: false }) }))]).blockers.map((b) => b.id), ['opt-cpt:wages:missing'])
check('an empty value that wasn’t chosen as "Not on my form" → missing', build([passport, i94, doc('opt-cpt', 'W-2', w2Fields({ stateWithheld: f('', { ticked: false }) }))]).blockers.map((b) => b.id), ['opt-cpt:stateWithheld:missing'])

console.log('\nINCOME THE ENGINE DOESN’T READ YET (listed, so the engine can say "no number")\n')
const f1042: ConfirmedDocument = doc('scholarship', '1042-S', { withholdingAgent: f('Sample University'), incomeCode: f('16'), grossIncome: f('12000.00'), exemptionCode: f('04', { ticked: true }), taxRate: f('00.00'), federalWithheld: f('0.00'), recipientCountry: f('IN') })
const withScholarship = build([...good, f1042], [...items, item('scholarship', '1042-S')], ['opt-cpt', 'scholarship'])
const scholarshipBuild = (docs: ConfirmedDocument[], use?: { paidFor?: unknown; stipend?: unknown }, its = [...items, item('scholarship', '1042-S')]) => buildTaxInput({ year: 2025, person: { citizenship: 'IN', visa: 'F-1' }, income: ['opt-cpt', 'scholarship'], items: its, documents: docs, scholarshipUse: use })
const sch = (o: Record<string, ConfirmedField> = {}) => doc('scholarship', '1042-S', { withholdingAgent: f('Sample University'), incomeCode: f('16'), grossIncome: f('9000.00'), exemptionCode: f('00'), taxRate: f('14.00'), federalWithheld: f('1260.00'), recipientCountry: f('Sample Country'), ...o })
check('a confirmed scholarship 1042-S → the boxes the engine needs, in cents (box 1, 2, 3a, 3b, 10)', scholarshipBuild([...good, sch()], { paidFor: 'living' }).scholarships, [{ itemId: 'scholarship', payer: 'Sample University', incomeCode: '16', gross: 900000, exemptionCode: '00', taxRate: '14.00', withheld: 126000 }])
check('…it is not “other” any more, and the W-2 is still there', [scholarshipBuild([...good, sch()], { paidFor: 'living' }).other, scholarshipBuild([...good, sch()], { paidFor: 'living' }).wages.length, scholarshipBuild([...good, sch()], { paidFor: 'living' }).blockers], [[], 1, []])
check('“What did it pay for?” not answered: a blocker that goes to that question', scholarshipBuild([...good, sch()]).blockers.map((x) => [x.id, x.fix.target.path]), [['scholarship:paid-for', '/income/scholarship-paid-for']])
check('“Both” without the living-costs amount: a blocker that goes to the amount question', scholarshipBuild([...good, sch()], { paidFor: 'both' }).blockers.map((x) => [x.id, x.fix.target.path]), [['scholarship:stipend', '/income/scholarship-stipend']])
check('the answers are kept as cents; anything odd is treated as not answered', [scholarshipBuild([...good, sch()], { paidFor: 'both', stipend: '4000.00' }).scholarshipUse, scholarshipBuild([...good, sch()], { paidFor: 'everything', stipend: 5 }).scholarshipUse], [{ paidFor: 'both', stipend: 400000 }, { paidFor: null, stipend: null }])
check('no scholarship: the questions don’t matter (no blocker)', build(good).blockers, [])
check('box 3a “Not on my form” → no exemption code (null)', scholarshipBuild([...good, sch({ exemptionCode: f('', { notOnForm: true }) })], { paidFor: 'living' }).scholarships[0].exemptionCode, null)
const inv = (docs: ConfirmedDocument[], id: 'investments' | 'trading', label: string, person: Record<string, unknown> = {}) => buildTaxInput({ year: 2025, person, income: ['opt-cpt', id], items: [...items, item(id, label)], documents: [...good, ...docs] })
check('a 1042-S on the investments document → an investment entry (boxes 1, 2, 3a, 3b, 10), never a scholarship', [inv([{ ...sch(), itemId: 'investments' }], 'investments', '1042-S or 1099-DIV').investments, inv([{ ...sch(), itemId: 'investments' }], 'investments', '1042-S or 1099-DIV').scholarships], [[{ itemId: 'investments', form: '1042-S', payer: 'Sample University', incomeCode: '16', gross: 900000, exemptionCode: '00', taxRate: '14.00', withheld: 126000 }], []])
const div = doc('investments', '1099-DIV', { payerName: f('Sample Brokerage'), ordinaryDividends: f('118.40'), federalWithheld: f('17.76') })
check('a 1099-DIV → dividends (box 1a) and box 4, in cents; no code or rate (the form has none)', inv([div], 'investments', '1042-S or 1099-DIV').investments, [{ itemId: 'investments', form: '1099-DIV', payer: 'Sample Brokerage', incomeCode: null, gross: 11840, exemptionCode: null, taxRate: null, withheld: 1776 }])
const b = (o: Record<string, ConfirmedField> = {}) => doc('trading', '1099-B', { payerName: f('Sample Brokerage'), proceeds: f('5200.00'), costBasis: f('4950.00'), federalWithheld: f('0.00'), ...o })
check('a 1099-B → proceeds (1d), cost basis (1e), box 4, in cents', inv([b()], 'trading', '1099-B or 1042-S').trades, [{ itemId: 'trading', form: '1099-B', payer: 'Sample Brokerage', proceeds: 520000, costBasis: 495000, withheld: 0, incomeCode: null }])
check('cost basis “Not on my form” → null (never zero: the gain would be wrong)', inv([b({ costBasis: f('', { notOnForm: true }) })], 'trading', '1099-B or 1042-S').trades[0].costBasis, null)
check('days in the U.S. pass through when sensible, otherwise null', [inv([], 'trading', 'x', { daysInUS: 140 }).person.daysInUS, inv([], 'trading', 'x', { daysInUS: 400 }).person.daysInUS, inv([], 'trading', 'x', { daysInUS: 12.5 }).person.daysInUS], [140, null, null])
const int = doc('bank-interest', '1099-INT', { payerName: f('Sample Bank'), interest: f('42.17'), federalWithheld: f('0.00') })
check('a confirmed 1099-INT for bank interest → interest and box 4, in cents', buildTaxInput({ year: 2025, person: {}, income: ['opt-cpt', 'bank-interest'], items: [...items, item('bank-interest', '1099-INT')], documents: [...good, int] }).bankInterest, [{ itemId: 'bank-interest', payer: 'Sample Bank', interest: 4217, withheld: 0 }])
check('self-reported income (no form) → listed in "other"', build(good, [...items, { id: 'freelance', kind: 'income', label: 'Freelance income', status: 'provided' }]).other, [{ itemId: 'freelance', form: null, label: 'Freelance income' }])
check('self-reported income with details still to add → blocker', build(good, [...items, { id: 'freelance', kind: 'income', label: 'Freelance income', status: 'later' }]).blockers.map((b) => b.id), ['freelance:details'])
check('income cards picked are passed on', build(good, items, ['opt-cpt', 'freelance']).incomeTypesPresent, ['opt-cpt', 'freelance'])

console.log('\nCONFIG (extraction.config.ts)\n')
check('1042-S credit is Box 10, withholding agent name is Box 12d (checked against the IRS form)', [FIELDS['1042-S'].find((x) => x.key === 'federalWithheld')?.box, FIELDS['1042-S'].find((x) => x.key === 'withholdingAgent')?.box], ['Box 10', 'Box 12d'])
check('W-2 boxes (checked against the IRS form): 1, 2, 15, 16, 17', ['wages', 'federalWithheld', 'state', 'stateWages', 'stateWithheld'].map((k) => FIELDS['W-2'].find((x) => x.key === k)?.box), ['Box 1', 'Box 2', 'Box 15', 'Box 16', 'Box 17'])

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
