// Checks the "What to do next" sheet's content (src/forms/nextSteps.ts, years/filing-2025.ts).
// Run: npm run check:nextsteps
//
// Two kinds of case, labelled in the output:
//   OFFICIAL  the expected words come straight from an IRS document (named in each case)
//   MINE      a made-up estimate; the expected steps are what the design asks for
// (The sheet itself, the close button and the E-file concept note are tested with real clicks: npm run audit:nextsteps.)
import { estimateReturn, type Estimate } from '../src/tax/estimate.ts'
import { buildTaxInput, type TaxInput } from '../src/tax/input.ts'
import { nextSteps } from '../src/forms/nextSteps.ts'
import { FILING_2025 } from '../src/tax/years/filing-2025.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}

// ---------------------------------------------------------------------------------------------
console.log('OFFICIAL: Instructions for Form 1040-NR (2025), pages 12 and 13 (“Where To File”, Individuals) and page 12 (due dates)\n')
check('not enclosing a payment: Department of the Treasury, Internal Revenue Service, Austin, TX 73301-0215, USA', FILING_2025.mail.withoutPayment.lines, ['Department of the Treasury', 'Internal Revenue Service', 'Austin, TX 73301-0215', 'USA'])
check('enclosing a payment: Internal Revenue Service, P.O. Box 1303, Charlotte, NC 28201-1303, USA', FILING_2025.mail.withPayment.lines, ['Internal Revenue Service', 'P.O. Box 1303', 'Charlotte, NC 28201-1303', 'USA'])
check('due dates: April 15, 2026 with wages subject to withholding; June 15, 2026 otherwise', [FILING_2025.due.wages.date, FILING_2025.due.noWages.date], ['April 15, 2026', 'June 15, 2026'])
check('page 13: “Only the U.S. Postal Service can deliver to P.O. boxes.” and page 12: these addresses are for returns filed in 2026', [FILING_2025.mail.postOfficeBoxNote, FILING_2025.mail.updatesNote], ['Only the U.S. Postal Service can deliver to a P.O. box.', 'These addresses are for returns filed in 2026. Check IRS.gov/Form1040NR for updates.'])
check('page 23 (Line 37): a check or money order on a U.S. bank, “2025 Form 1040-NR”, name, address, daytime phone, SSN, and Form 1040-V', ['U.S. bank', '“2025 Form 1040-NR”', 'daytime phone number', 'SSN', 'Form 1040-V'].map((t) => FILING_2025.pay.check.includes(t)), [true, true, true, true, true])
check('the payment links are the IRS’s own (IRS.gov/Payments, and the foreign electronic payments page from Line 37)', [FILING_2025.pay.url, FILING_2025.pay.foreignUrl], ['https://www.irs.gov/payments', 'https://www.irs.gov/individuals/international-taxpayers/foreign-electronic-payments'])
check('every address and rule cites its page', [FILING_2025.mail.source, FILING_2025.due.source, FILING_2025.pay.source, FILING_2025.attach.source, FILING_2025.refund.source].map((s) => /(page|pages) \d+/.test(s)), [true, true, true, true, true])
check('what the documents leave open is marked TODO confirm with CPA', FILING_2025.todo.length > 0 && FILING_2025.todo.every((t) => t.startsWith('TODO confirm with CPA')), true)

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: which steps show (a made-up estimate: the fake W-2, wages $38,450, federal withheld $3,186)\n')
const base = buildTaxInput({ year: 2025, person: {}, income: [], items: [], documents: [] })
const W2 = { itemId: 'opt-cpt', employer: 'Sample Employer Inc. (FAKE)', wages: 3_845_000, federalWithheld: 318_600, stateCode: 'NY', stateWages: 3_845_000, stateWithheld: 189_300 }
const input = (o: Partial<TaxInput> = {}): TaxInput => ({ ...base, person: { citizenship: 'BR', visa: 'F-1', livedBefore: 'BR', marital: 'single', digitalAssets: 'no', daysInUS: null }, wages: [W2], ...o })
const owed = estimateReturn(input()) // owes $1,193
const refund = estimateReturn(input({ person: { ...input().person, livedBefore: 'IN' } })) // India treaty: refund $697
const zero = estimateReturn(input({ wages: [{ ...W2, wages: 0, federalWithheld: 0 }] }))
const noNumber = estimateReturn(input({ person: { ...input().person, marital: 'married' } }))
const ids = (e: Estimate) => nextSteps(e)?.steps.map((s) => s.id)
check('amount owed: print, attach, mail, pay (no refund step)', ids(owed), ['print', 'attach', 'mail', 'pay'])
check('refund: print, attach, mail, refund (no pay step)', ids(refund), ['print', 'attach', 'mail', 'refund'])
check('nothing owed, no refund: print, attach, mail', ids(zero), ['print', 'attach', 'mail'])
check('no estimate (married: no number): print, attach, mail only', ids(noNumber), ['print', 'attach', 'mail'])
check('the steps’ titles, in the words asked for', nextSteps(owed)?.steps.slice(0, 3).map((s) => s.title), ['Print your forms and sign the 1040-NR', 'Attach Copy B of your W-2 to the front of the 1040-NR', 'Mail it'])
check('the mail step shows BOTH addresses, with and without a payment', nextSteps(owed)?.steps[2].addresses?.map((a) => [a.label, a.lines[0]]), [['Not sending a payment', 'Department of the Treasury'], ['Sending a payment', 'Internal Revenue Service']])
check('the pay step links to the official payment page first, and says what to write on a check', [nextSteps(owed)?.steps[3].links?.[0].href, nextSteps(owed)?.steps[3].body.some((t) => t.includes('Form 1040-V'))], ['https://www.irs.gov/payments', true])

console.log('\nMINE: the due date, shown as upcoming\n')
check('with a W-2: due April 15, 2026', nextSteps(owed)?.due, 'Your 2025 return is due April 15, 2026.')
check('without a W-2 (a scholarship only): due June 15, 2026', nextSteps({ ...owed, dueBasis: 'no-wages' })?.due, 'Your 2025 return is due June 15, 2026.')
check('the estimate says which: a W-2 → "wages", none → "no-wages"', [owed.dueBasis, estimateReturn(input({ wages: [] })).dueBasis], ['wages', 'no-wages'])

console.log('\nMINE: plain words, no promises, nothing about filing late\n')
const text = (e: Estimate) => JSON.stringify(nextSteps(e)).replace(/"source":"[^"]*"/g, '') // the sources are for the page's small print, not the plain copy
check('no late-filing wording anywhere (late, penalty, overdue, past due, extension, deadline missed)', /late|penalt|overdue|past due|extension|missed/i.test(text(owed) + text(refund)), false)
check('no promise about refund timing: no days, weeks, months, fast, quick, soon, within, guaranteed in the refund step', /\b(days?|weeks?|months?|fast|quick|quickly|soon|within|guarantee)/i.test(JSON.stringify(nextSteps(refund)?.steps.find((s) => s.id === 'refund')?.body)), false)
check('the refund step says what the IRS does and that nothing is needed after mailing, and points to lines 35a to 35e', nextSteps(refund)?.steps.find((s) => s.id === 'refund')?.body, ['The IRS sends your refund after it processes your return. You don’t need to do anything after you mail it.', 'The download leaves how you’d like to be paid (lines 35a to 35e) blank. Fill that in by hand before you mail it.'])
check('no jargon in the step words: no Schedule, withholding, NEC, FDAP, 1042-S code or "effectively connected"', /Schedule|withholding|NEC|FDAP|effectively connected/i.test(text(owed) + text(refund)), false)
check('every step names its IRS page', nextSteps(owed)?.steps.concat(nextSteps(refund)?.steps ?? []).every((s) => /(page|pages) \d+/.test(s.source)), true)
check('a tax year with no filing details (2024) gives no sheet', nextSteps({ ...owed, year: 2024 }), null)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll next-steps checks passed.')
process.exit(failed ? 1 : 0)
