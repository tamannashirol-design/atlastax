// Checks which label, amount and options the E-file concept screen shows (src/result/efile.ts).
// Run: npm run check:efile
// MINE: made-up estimates (the fake W-2: wages $38,450, federal withheld $3,186). The screen itself (the animation,
// the rows, the celebration) is tested with real clicks: npm run audit:efile.
import { estimateReturn } from '../src/tax/estimate.ts'
import { buildTaxInput, type TaxInput } from '../src/tax/input.ts'
import { CONCEPT_LABEL, efileView } from '../src/result/efile.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const base = buildTaxInput({ year: 2025, person: {}, income: [], items: [], documents: [] })
const W2 = { itemId: 'opt-cpt', employer: 'Sample Employer Inc. (FAKE)', wages: 3_845_000, federalWithheld: 318_600, stateCode: 'NY', stateWages: 3_845_000, stateWithheld: 189_300 }
const input = (o: Partial<TaxInput> = {}, lived = 'BR'): TaxInput => ({ ...base, person: { citizenship: 'BR', visa: 'F-1', livedBefore: lived, marital: 'single', digitalAssets: 'no', daysInUS: null, taxHome: null }, wages: [W2], ...o })

console.log('MINE: what the screen shows\n')
const owed = efileView(estimateReturn(input())) // owes $1,193
const refund = efileView(estimateReturn(input({}, 'IN'))) // India treaty: refund $697
check('owed: “Amount owed” with the federal amount ($1,193), in cents', [owed.kind, owed.kind === 'owed' && owed.label, owed.kind === 'owed' && owed.cents], ['owed', 'Amount owed', 119_300])
check('owed: Debit or credit card and Bank account (both go to the celebration), then Pay by check (opens the sheet)', owed.kind === 'owed' && owed.options.map((o) => [o.label, o.action]), [['Debit or credit card', 'celebrate'], ['Bank account', 'celebrate'], ['Pay by check', 'sheet']])
check('refund: “Your refund” with the amount ($697)', [refund.kind, refund.kind === 'refund' && refund.label, refund.kind === 'refund' && refund.cents], ['refund', 'Your refund', 69_700])
check('refund: Direct deposit (goes to the celebration) and Paper check by mail (opens the sheet)', refund.kind === 'refund' && refund.options.map((o) => [o.label, o.action]), [['Direct deposit', 'celebrate'], ['Paper check by mail', 'sheet']])
check('nothing owed, no refund: no amount and no options', efileView(estimateReturn(input({ wages: [{ ...W2, wages: 0, federalWithheld: 0 }] }))).kind, 'none')
check('no number yet (married: no estimate number): no amount, says to finish the estimate', efileView(estimateReturn(input({ person: { ...input().person, marital: 'married' } }))), { kind: 'unavailable', message: 'We don’t have a number for you yet. Finish your estimate first.' })
check('a blocker (something unconfirmed) also means no number', efileView({ ...estimateReturn(input()), blockers: [{ id: 'x', reason: 'x', fix: { label: 'x', target: { path: '/', state: null } } }] }).kind, 'unavailable')
check('the state is not part of this screen: a state refund or amount never shows here', efileView(estimateReturn(input())).kind === 'owed' && JSON.stringify(efileView(estimateReturn(input()))).includes('state') === false, true)
check('number off (hidden): the amount is null, never a made-up number', ((v) => v.kind === 'owed' && v.cents)(efileView({ ...estimateReturn(input()), federal: { ...(estimateReturn(input()).federal as object), amount: null } as never })), null)

console.log('\nMINE: plain words, no promises\n')
const words = JSON.stringify([owed, refund, CONCEPT_LABEL])
check('the label is exactly “Concept: not connected to the IRS”', CONCEPT_LABEL, 'Concept: not connected to the IRS')
check('no promise about speed or fees: no fast, quick, instant, free, no fee, same day, days, within', /\b(fast|quick|quickly|instant|free|fees?|same[- ]day|days?|within|guarantee)/i.test(words), false)
check('no brand names (card networks, banks, payment apps)', /visa|mastercard|amex|american express|discover|paypal|venmo|zelle|chase|apple pay|google pay/i.test(words), false)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll e-file checks passed.')
process.exit(failed ? 1 : 0)
