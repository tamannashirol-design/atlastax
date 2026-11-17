// Checks the federal estimate's two newer income types (src/tax/federal.ts, years/income-2025.ts):
// U.S. bank interest from a 1099-INT (exempt: shown, never taxed) and a scholarship on a 1042-S (only the taxable part).
// Run: npm run check:income
//
// Two kinds of case, labelled in the output:
//   OFFICIAL  the inputs and expected lines come from an IRS publication (the example named in each case)
//   MINE      a synthetic case I made up (fake documents only); the expected answer is worked out by hand in the comment
import { estimateReturn, hideNumbers, isCalculated, INTEREST_NOTE, DEGREE_NOTE, type Section } from '../src/tax/estimate.ts'
import { STATE_INTEREST_NOTE } from '../src/tax/state.ts'
import { taxableScholarship } from '../src/tax/federal.ts'
import { buildTaxInput, type InterestInput, type ScholarshipInput, type TaxInput } from '../src/tax/input.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const D = (n: number) => n * 100
const base = buildTaxInput({ year: 2025, person: {}, income: [], items: [], documents: [] })
const W2 = { itemId: 'opt-cpt', employer: 'Sample Employer Inc. (FAKE)', wages: D(38_450), federalWithheld: D(3_186), stateCode: 'NY', stateWages: D(38_450), stateWithheld: D(1_893) }
const scholarship = (o: Partial<ScholarshipInput> = {}): ScholarshipInput => ({ itemId: 'scholarship', payer: 'Sample University', incomeCode: '16', gross: D(9_000), exemptionCode: '00', taxRate: '14.00', withheld: D(1_260), ...o })
const interest = (o: Partial<InterestInput> = {}): InterestInput => ({ itemId: 'bank-interest', payer: 'Sample Bank', interest: 4_217, withheld: 0, ...o })
const input = (o: Partial<TaxInput> = {}, lived: string | null = 'BR'): TaxInput => ({ ...base, person: { citizenship: 'BR', visa: 'F-1', livedBefore: lived, marital: 'single', digitalAssets: 'no' }, ...o })
const use = (paidFor: 'tuition' | 'living' | 'both', stipend: number | null = null) => ({ paidFor, stipend })
const fed = (o: Partial<TaxInput> = {}, lived: string | null = 'BR') => estimateReturn(input(o, lived)).federal
const line = (s: Section, id: string) => (isCalculated(s) ? (s.lines.find((l) => l.id === id)?.amount ?? null) : NaN)
const sum = (s: Section) => (isCalculated(s) ? [s.status, s.amount, line(s, 'scholarship'), line(s, 'total-income'), line(s, 'tax'), line(s, 'total-payments') ?? line(s, 'withheld')] : [s.status, (s as { missing?: string[] }).missing])

// ---------------------------------------------------------------------------------------------
console.log('OFFICIAL: Instructions for Form 1040-NR (2025), page 31, Line 8r Example 1 (full scholarship, no treaty)\n')
// Tuition and fees $25,000 + required books $1,000 + room and board $9,000. "The Form 1042-S … shows $9,000 in box 2 and $1,260
// (14% of $9,000) in box 10." "You would enter $9,000 on line 8r." Box 2 holds only the room and board, which is a living cost.
const ex1 = fed({ scholarships: [scholarship()], scholarshipUse: use('living') })
check('line 8r (→ line 8) is $9,000, and line 25g credits $1,260 from box 10', [line(ex1, 'scholarship'), line(ex1, 'withheld-1042s')], [D(9_000), D(1_260)])
check('box 2 shows only the $9,000: the $26,000 of tuition, fees and books was never on the 1042-S, so nothing more comes off', line(ex1, 'scholarship-excluded'), null)
// MINE, on top of the official lines: taxable 9,000 → Tax Table row 9,000–9,050, middle 9,025 × 10% = 902.50 → $903; payments 1,260 → refund 357
check('…and the rest, worked out by us (MINE): tax $903, refund $357 (the IRS gives no final figure for this example)', sum(ex1), ['refund', D(357), D(9_000), D(9_000), D(903), D(1_260)])

console.log('\nOFFICIAL: Line 8r Example 2 (the same scholarship, exempt by treaty) is handled as NO number, on purpose\n')
const ex2 = fed({ scholarships: [scholarship({ exemptionCode: '04', taxRate: '00.00' })], scholarshipUse: use('living') })
check('box 3a code 04 (“Exempt under tax treaty”, 1042-S instructions page 37): no number, and it says why', sum(ex2), ['not-calculated', ['Your 1042-S shows exemption code 04 in box 3a. The estimate doesn’t work out a scholarship that is claimed as exempt yet.']])

console.log('\nOFFICIAL: the rules, from Pub 519 and the 1042-S instructions\n')
// Pub 519 (2025), page 22: U.S. bank deposit interest not connected with a U.S. business is excluded from income
check('U.S. bank interest doesn’t change taxable income or tax (Pub 519, page 22)', [line(fed({ wages: [W2], bankInterest: [interest()] }), 'taxable'), line(fed({ wages: [W2], bankInterest: [interest()] }), 'tax')], [line(fed({ wages: [W2] }), 'taxable'), line(fed({ wages: [W2] }), 'tax')])
// Pub 519 (2025), pages 24–25: only qualified expenses (tuition, required fees, books) can be left out; room, board, travel are taxable
check('tuition, fees and books only: nothing is taxed; living costs only: all of box 2 is (Pub 519, pages 24–25)', [taxableScholarship(9_000, use('tuition')), taxableScholarship(9_000, use('living'))], [0, 9_000])
check('box 1 must be income code 16, “Scholarship or fellowship grants” (1042-S instructions, page 36): code 19 (compensation for teaching) gives no number', sum(fed({ scholarships: [scholarship({ incomeCode: '19' })], scholarshipUse: use('living') })), ['not-calculated', ['Your 1042-S shows income code 19 in box 1, not a scholarship (code 16). The estimate can’t include it yet.']])
check('box 3a “00” (tax withheld) or blank (backup withholding) is worked out (1042-S instructions, page 26)', [fed({ scholarships: [scholarship({ exemptionCode: '00' })], scholarshipUse: use('living') }).status, fed({ scholarships: [scholarship({ exemptionCode: null })], scholarshipUse: use('living') }).status], ['refund', 'refund'])
check('any exemption code 01 to 24 gives no number (02 “Exempt under IRC” here)', fed({ scholarships: [scholarship({ exemptionCode: '02', taxRate: '00.00' })], scholarshipUse: use('living') }).status, 'not-calculated')

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: scholarship with the fake W-2 (wages $38,450, withheld $3,186; 1042-S box 2 $9,000, box 10 $1,260)\n')
// both, $4,000 for living costs: total 38,450 + 4,000 = 42,450 → row 42,450–42,500, middle 42,475: 1,192.50 + 12% × 30,550 (= 3,666) = 4,858.50 → $4,859. Payments 3,186 + 1,260 = 4,446 → owes 413
const both = fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('both', D(4_000)) })
check('“Both”, $4,000 for living costs: taxable scholarship $4,000, tax $4,859, payments $4,446, owes $413', sum(both), ['owed', D(413), D(4_000), D(42_450), D(4_859), D(4_446)])
check('…the part that isn’t taxed is shown too ($5,000), with box 2 ($9,000)', [line(both, 'scholarship-1042s'), line(both, 'scholarship-excluded')], [D(9_000), D(5_000)])
// tuition only: taxable 0 → tax 4,379 (wages only); payments 4,446 → refund 67
check('“Tuition, fees and books”: nothing taxed, tax $4,379, the $1,260 still credited: refund $67', sum(fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('tuition') })), ['refund', D(67), 0, D(38_450), D(4_379), D(4_446)])
// living: total 47,450 → middle 47,475: 1,192.50 + 12% × 35,550 (= 4,266) = 5,458.50 → $5,459; owes 5,459 − 4,446 = 1,013
check('“Living costs”: all $9,000 taxed, tax $5,459, owes $1,013', sum(fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('living') })), ['owed', D(1_013), D(9_000), D(47_450), D(5_459), D(4_446)])
check('a living-costs amount bigger than box 2 counts only box 2 ($12,000 said, $9,000 on the form)', line(fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('both', D(12_000)) }), 'scholarship'), D(9_000))
// two 1042-S: 4,500.40 + 4,500.40 = 9,000.80 → $9,001; withheld 630 + 630 = 1,260
check('two 1042-S forms: added first, then rounded', [line(fed({ wages: [W2], scholarships: [scholarship({ gross: 450_040, withheld: D(630) }), scholarship({ gross: 450_040, withheld: D(630) })], scholarshipUse: use('living') }), 'scholarship-1042s'), line(fed({ wages: [W2], scholarships: [scholarship({ gross: 450_040, withheld: D(630) }), scholarship({ gross: 450_040, withheld: D(630) })], scholarshipUse: use('living') }), 'withheld-1042s')], [D(9_001), D(1_260)])

console.log('\nMINE: the India and China rules, only as they work now (from the country lived in before)\n')
// India, living: total 47,450 − 15,750 = 31,700 → middle 31,725: 1,192.50 + 12% × 19,800 (= 2,376) = 3,568.50 → $3,569; refund 4,446 − 3,569 = 877
check('India: the standard deduction comes off wages plus the taxable scholarship: tax $3,569, refund $877', sum(fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('living') }, 'IN')), ['refund', D(877), D(9_000), D(47_450), D(3_569), D(4_446)])
check('China with a taxable scholarship: no number, and it says why (the treaty may cover it; not worked out)', sum(fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('living') }, 'CN')), ['not-calculated', ['You lived in China before coming to the U.S. The U.S.–China treaty may make your scholarship tax-free, and the estimate doesn’t work that out yet.']])
// China, tuition only: nothing taxable → wages 38,450 − 5,000 = 33,450 → tax 3,779; refund 4,446 − 3,779 = 667
check('China, scholarship all for tuition: the $5,000 wage exemption as before, tax $3,779, refund $667', sum(fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('tuition') }, 'CN')), ['refund', D(667), 0, D(33_450), D(3_779), D(4_446)])
check('the China exemption still applies only to wages (never to the scholarship)', line(fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('tuition') }, 'CN'), 'treaty'), D(5_000))

console.log('\nMINE: bank interest (1099-INT, fake: $42.17 from “Sample Bank”)\n')
const withInterest = fed({ wages: [W2], bankInterest: [interest()] })
check('shown as its own line, not taxed: $42 (rounded), and the estimate is unchanged (owes $1,193)', [line(withInterest, 'bank-interest'), line(withInterest, 'total-income'), isCalculated(withInterest) && withInterest.amount], [D(42), D(38_450), D(1_193)])
check('the line says where it goes: nowhere on Form 1040-NR', isCalculated(withInterest) && withInterest.lines.find((l) => l.id === 'bank-interest')?.formLine, 'Not entered on Form 1040-NR')
check('only bank interest, no other income: nothing owed, no refund', sum(fed({ bankInterest: [interest()] })), ['zero', 0, null, 0, 0, 0])
check('tax withheld from the interest (box 4): no number, and it says why', sum(fed({ wages: [W2], bankInterest: [interest({ withheld: 500 })] })), ['not-calculated', ['Your bank withheld federal tax from your interest (box 4 of your 1099-INT). The estimate doesn’t credit that yet.']])

console.log('\nMINE: the notes\n')
const notes = (o: Partial<TaxInput>) => estimateReturn(input(o)).notes
check('bank interest: “Assumes this is interest from a U.S. bank account.”', notes({ wages: [W2], bankInterest: [interest()] }).includes(INTEREST_NOTE), true)
check('a scholarship partly or wholly for tuition: the degree-candidate assumption is said', [notes({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('tuition') }).includes(DEGREE_NOTE), notes({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('both', D(4_000)) }).includes(DEGREE_NOTE)], [true, true])
check('living costs only (nothing left out) or no scholarship: no degree note', [notes({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('living') }).includes(DEGREE_NOTE), notes({ wages: [W2] }).includes(DEGREE_NOTE)], [false, false])

console.log('\nMINE: the state estimate doesn’t leave them out silently\n')
check('New York with a scholarship: not calculated, says why', [estimateReturn(input({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('living') })).state.status, (estimateReturn(input({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('living') })).state as { missing: string[] }).missing], ['not-calculated', ['We can’t include your scholarship in the state estimate yet.']])
// MINE (prototype assumption, TODO confirm with CPA): the state doesn't tax U.S. bank interest, so the state number is the same as without it.
// The fake W-2 (NY, wages $38,450, state withheld $1,893) with $42.17 of interest; and the same wages in California.
const stateOf = (o: Partial<TaxInput>) => estimateReturn(input({ wages: [W2], ...o })).state
const ca = { ...W2, stateCode: 'CA' }
const sameNumber = (a: Section, b: Section) => isCalculated(a) && isCalculated(b) && a.status === b.status && a.amount === b.amount
check('New York with bank interest: the same state number as without it', sameNumber(stateOf({ bankInterest: [interest()] }), stateOf({})), true)
check('California with bank interest: the same state number as without it', sameNumber(stateOf({ wages: [ca], bankInterest: [interest()] }), stateOf({ wages: [ca] })), true)
check('the state breakdown shows “Bank interest (not taxed by the state)” = $42 (whole dollars), from the 1099-INT, marked TODO confirm with CPA', ((s) => isCalculated(s) && s.lines.filter((l) => l.id === 'state-bank-interest').map((l) => [l.label, l.amount, l.source.includes('TODO confirm with CPA')]))(stateOf({ bankInterest: [interest()] })), [['Bank interest (not taxed by the state)', D(42), true]])
check('…in California too', ((s) => isCalculated(s) && s.lines.some((l) => l.id === 'state-bank-interest'))(stateOf({ wages: [ca], bankInterest: [interest()] })), true)
check('no bank interest: no such line, and no state note', [((s) => isCalculated(s) && s.lines.some((l) => l.id === 'state-bank-interest'))(stateOf({})), estimateReturn(input({ wages: [W2] })).notes.includes(STATE_INTEREST_NOTE)], [false, false])
check('the note “Assumes this state doesn’t tax your bank interest.” shows with a calculated state', [STATE_INTEREST_NOTE, estimateReturn(input({ wages: [W2], bankInterest: [interest()] })).notes.includes(STATE_INTEREST_NOTE)], ['Assumes this state doesn’t tax your bank interest.', true])
check('no state number (a state we don’t do, or no-tax Texas): the note is not shown', [estimateReturn(input({ wages: [{ ...W2, stateCode: 'TX' }], bankInterest: [interest()] })).notes.includes(STATE_INTEREST_NOTE), estimateReturn(input({ wages: [{ ...W2, stateCode: 'FL' }], bankInterest: [interest()] })).notes.includes(STATE_INTEREST_NOTE)], [false, false])
check('other income types keep the no-number rule: dividends, trading', [(estimateReturn(input({ wages: [W2], bankInterest: [interest()], investments: [{ form: '1099-DIV', gross: D(100), withheld: 0, incomeCode: null, exemptionCode: null, taxRate: null } as never] })).state as { missing?: string[] }).missing, (estimateReturn(input({ wages: [W2], trades: [{ form: '1099-B', proceeds: D(200), costBasis: D(100), withheld: 0 } as never] })).state as { missing?: string[] }).missing], [['We can’t include your investment income in the state estimate yet.'], ['We can’t include your trading in the state estimate yet.']])
check('…and the scholarship, even with bank interest', (estimateReturn(input({ wages: [W2], bankInterest: [interest()], scholarships: [scholarship()], scholarshipUse: use('living') })).state as { missing: string[] }).missing, ['We can’t include your scholarship in the state estimate yet.'])
check('number off: the state interest amount is not sent', JSON.stringify(hideNumbers(estimateReturn(input({ wages: [W2], bankInterest: [interest()] })))).includes('4217'), false)
check('Texas still “no state return needed”', estimateReturn(input({ wages: [{ ...W2, stateCode: 'TX' }], scholarships: [scholarship()], scholarshipUse: use('living') })).state.status, 'no-tax')

console.log('\nMINE: “Show how we got this”, citations, and “Show estimate number” off\n')
const full = fed({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('both', D(4_000)), bankInterest: [interest()] })
const ids = isCalculated(full) ? full.lines.map((l) => l.id) : []
check('every new line is in the breakdown, in order', ids, ['wages', 'scholarship-1042s', 'scholarship-excluded', 'scholarship', 'bank-interest', 'total-income', 'deduction', 'taxable', 'tax', 'withheld', 'withheld-1042s', 'total-payments', 'result'])
check('every line names its form line and an IRS publication with a page', isCalculated(full) && full.lines.every((l) => !!l.formLine && /(Publication 519|Instructions for Form 10(40|42)(-NR|-S)?|Form 1040-NR) \(2025\)(, (page|pages) \d|$|;)/.test(l.source ?? '')), true)
check('"Figures used" cites Pub 519, the 1040-NR instructions and the 1042-S instructions, each with a page', isCalculated(full) && ['Publication 519 (2025), page 22', 'Publication 519 (2025), pages 24 and 25', 'Publication 519 (2025), page 26', 'Instructions for Form 1040-NR (2025), page 31', 'Instructions for Form 1042-S (2025), page 25', 'Instructions for Form 1042-S (2025), page 29', 'Instructions for Form 1040-NR (2025), page 19'].map((c) => full.sources.some((s) => s.citation.includes(c))), [true, true, true, true, true, true, true])
const hidden = JSON.stringify(hideNumbers(estimateReturn(input({ wages: [W2], scholarships: [scholarship()], scholarshipUse: use('both', D(4_000)), bankInterest: [interest()] }))))
check('number off: none of the new amounts is sent (cents or dollars)', /900000|126000|400000|500000|4200|444600|9,000|1,260|4,446|5,000/.test(hidden.replace(/"citation":"[^"]*"/g, '')), false)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll income checks passed.')
process.exit(failed ? 1 : 0)
