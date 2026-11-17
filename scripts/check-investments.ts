// Checks the federal estimate for investments and trading (src/tax/federal.ts, years/income-2025.ts):
// dividends and interest on a 1042-S or 1099-DIV (the flat 30%, Schedule NEC → line 23a) and trading on a 1099-B
// (the 183-day rule), plus the matching 1040-NR download lines.
// Run: npm run check:investments
//
// Two kinds of case, labelled in the output:
//   OFFICIAL  the inputs and expected figures come from an IRS publication (named in each case)
//   MINE      a synthetic case I made up (fake documents only); the expected answer is worked out by hand in the comment
import { PDFDocument } from 'pdf-lib'
import { renderForm } from '../server/forms.ts'
import { build1040NR, F1040NR } from '../src/forms/map-1040nr.ts'
import { DIVIDEND_NOTE, estimateReturn, hideNumbers, isCalculated, type Section } from '../src/tax/estimate.ts'
import { buildTaxInput, type InvestmentInput, type TaxInput, type TradeInput } from '../src/tax/input.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const D = (n: number) => n * 100
const base = buildTaxInput({ year: 2025, person: {}, income: [], items: [], documents: [] })
const W2 = { itemId: 'opt-cpt', employer: 'Sample Employer Inc. (FAKE)', wages: D(38_450), federalWithheld: D(3_186), stateCode: 'NY', stateWages: D(38_450), stateWithheld: D(1_893) }
const div1042 = (o: Partial<InvestmentInput> = {}): InvestmentInput => ({ itemId: 'investments', form: '1042-S', payer: 'Sample Brokerage', incomeCode: '06', gross: D(1_400), exemptionCode: '00', taxRate: '30.00', withheld: D(420), ...o })
const div1099 = (o: Partial<InvestmentInput> = {}): InvestmentInput => ({ itemId: 'investments', form: '1099-DIV', payer: 'Sample Brokerage', incomeCode: null, gross: 11_840, exemptionCode: null, taxRate: null, withheld: 1_776, ...o })
const trade = (o: Partial<TradeInput> = {}): TradeInput => ({ itemId: 'trading', form: '1099-B', payer: 'Sample Brokerage', proceeds: D(5_200), costBasis: D(4_950), withheld: 0, incomeCode: null, ...o })
const input = (o: Partial<TaxInput> = {}, lived: string | null = 'BR', days: number | null = 140): TaxInput => ({ ...base, person: { citizenship: 'BR', visa: 'F-1', livedBefore: lived, marital: 'single', digitalAssets: 'no', daysInUS: days }, ...o })
const fed = (o: Partial<TaxInput> = {}, lived: string | null = 'BR', days: number | null = 140) => estimateReturn(input(o, lived, days)).federal
const line = (s: Section, id: string) => (isCalculated(s) ? (s.lines.find((l) => l.id === id)?.amount ?? null) : NaN)
const missing = (s: Section) => (s as { missing?: string[] }).missing

// ---------------------------------------------------------------------------------------------
console.log('OFFICIAL: Publication 519 (2025), page 65, Arthur Banks (no treaty rate applied)\n')
// "Compensation … $24,500 … Tax determined by graduated rate … $2,705. Plus: Tax on gross dividends ($1,400 × 30%) … 420.
// Tax determined as though treaty had not come into effect … $3,125." Here: wages on a W-2, dividends on a 1042-S at 30.00.
const arthur = fed({ wages: [{ ...W2, wages: D(24_500), federalWithheld: 0 }], investments: [div1042({ withheld: 0 })] })
check('graduated tax on $24,500 = $2,705; tax on dividends $1,400 × 30% = $420; total tax $3,125', [line(arthur, 'tax'), line(arthur, 'dividends'), line(arthur, 'nec-tax'), line(arthur, 'total-tax')], [D(2_705), D(1_400), D(420), D(3_125)])
check('…and the dividends are not in total income (line 9): they are taxed apart, at the flat rate', line(arthur, 'total-income'), D(24_500))

console.log('\nOFFICIAL: the same example with the 15% treaty rate ($1,400 × 15% = $210) is handled as NO number, on purpose\n')
check('box 3b 15.00: no number, and it says why', missing(fed({ wages: [{ ...W2, wages: D(24_500), federalWithheld: 0 }], investments: [div1042({ taxRate: '15.00', withheld: D(210) })] })), ['Your investment 1042-S shows a 15.00 rate in box 3b. A rate other than 30% comes from a tax treaty, which the estimate doesn’t cover yet.'])

console.log('\nOFFICIAL: the rules, from Pub 519, the 1040-NR instructions and the 1042-S instructions\n')
// Pub 519 p. 32 and 1040-NR instructions p. 44: gains count only with at least 183 days; fewer → tax exempt
check('182 days: trading gains are not taxed (and shown as such)', [fed({ wages: [W2], trades: [trade()] }, 'BR', 182).status, line(fed({ wages: [W2], trades: [trade()] }, 'BR', 182), 'trading'), line(fed({ wages: [W2], trades: [trade()] }, 'BR', 182), 'tax')], ['owed', D(250), D(4_379)])
check('183 days: taxable in principle, but it depends on the tax home (Pub 519 p. 20), which we don’t ask: no number, says what’s missing', missing(fed({ wages: [W2], trades: [trade()] }, 'BR', 183)), ['You were in the U.S. 183 days in 2025, so your trading gains may be taxed. That depends on where your tax home was, which we don’t ask yet.'])
check('losses beyond gains aren’t allowed: a net loss is $0, never a deduction (Pub 519 p. 32)', [line(fed({ wages: [W2], trades: [trade({ costBasis: D(6_000) })] }, 'BR', 300), 'trading'), line(fed({ wages: [W2], trades: [trade({ costBasis: D(6_000) })] }, 'BR', 300), 'taxable')], [0, D(38_450)])
// Pub 519 p. 22 and 1040-NR instructions p. 43: deposit interest and portfolio interest are exempt
check('1042-S deposit interest (code 29, exemption 02, rate 00.00) and portfolio interest (code 01, exemption 05): not taxed', [line(fed({ wages: [W2], investments: [div1042({ incomeCode: '29', exemptionCode: '02', taxRate: '00.00', withheld: 0, gross: D(80) })] }), 'investment-interest-exempt'), line(fed({ wages: [W2], investments: [div1042({ incomeCode: '01', exemptionCode: '05', taxRate: '00.00', withheld: 0, gross: D(80) })] }), 'nec-tax')], [D(80), null])
check('1042-S interest at 30% (code 01): taxed at 30% like dividends', [line(fed({ wages: [W2], investments: [div1042({ incomeCode: '01', gross: D(100), withheld: D(30) })] }), 'nec-interest'), line(fed({ wages: [W2], investments: [div1042({ incomeCode: '01', gross: D(100), withheld: D(30) })] }), 'nec-tax')], [D(100), D(30)])
check('an income code the estimate doesn’t work out (07, dividends at a direct rate; 1042-S instructions p. 36): no number', missing(fed({ wages: [W2], investments: [div1042({ incomeCode: '07' })] })), ['Your investment 1042-S shows income code 07 in box 1. The estimate only works out dividends (code 06) and interest (code 01) yet.'])
check('an exemption code on a taxed item (04 treaty): no number', fed({ wages: [W2], investments: [div1042({ exemptionCode: '04', taxRate: '00.00' })] }).status, 'not-calculated')

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: with the fake W-2 (wages $38,450, withheld $3,186)\n')
// 1042-S dividends 1,400 at 30% = 420, withheld 420: tax 4,379 + 420 = 4,799; payments 3,186 + 420 = 3,606; owes 1,193
const withDiv = fed({ wages: [W2], investments: [div1042()] })
check('1042-S dividends $1,400 (30% withheld): total tax $4,799, payments $3,606, owes $1,193', [line(withDiv, 'total-tax'), line(withDiv, 'total-payments'), isCalculated(withDiv) && withDiv.status, isCalculated(withDiv) && withDiv.amount], [D(4_799), D(3_606), 'owed', D(1_193)])
// 1099-DIV 118.40 → $118; × 30% = 35.40 → $35; withheld 17.76 → $18 (line 25b): total tax 4,414; payments 3,204; owes 1,210
const withDiv1099 = fed({ wages: [W2], investments: [div1099()] })
check('1099-DIV $118.40: $118 at 30% = $35; box 4 $18 on line 25b; owes $1,210', [line(withDiv1099, 'dividends'), line(withDiv1099, 'nec-tax'), line(withDiv1099, 'withheld-1099'), isCalculated(withDiv1099) && withDiv1099.amount], [D(118), D(35), D(18), D(1_210)])
check('…and the page says what it assumed: no treaty lowers the 30%', estimateReturn(input({ wages: [W2], investments: [div1099()] })).notes.includes(DIVIDEND_NOTE), true)
// 1099-B 5,200 − 4,950 = 250 gain, 140 days: not taxed; tax 4,379; owes 1,193 (as wages only)
check('1099-B gain $250 with 140 days: not taxed, owes $1,193 as before', [line(fed({ wages: [W2], trades: [trade()] }), 'trading'), isCalculated(fed({ wages: [W2], trades: [trade()] })) && (fed({ wages: [W2], trades: [trade()] }) as { amount: number }).amount], [D(250), D(1_193)])
check('1099-B tax withheld (box 4) $100 is credited on line 25b: owes $1,093', [line(fed({ wages: [W2], trades: [trade({ withheld: D(100) })] }), 'withheld-1099'), (fed({ wages: [W2], trades: [trade({ withheld: D(100) })] }) as { amount: number }).amount], [D(100), D(1_093)])
check('days not answered and a gain: no number, says what’s missing', missing(fed({ wages: [W2], trades: [trade()] }, 'BR', null)), ['To check the 183-day rule for your trading gains we need the days you were in the U.S. in 2025. Finish “Time in the U.S.” first.'])
check('days not answered but a net loss: nothing to tax, so a number', fed({ wages: [W2], trades: [trade({ costBasis: D(6_000) })] }, 'BR', null).status, 'owed')
check('cost basis not on the 1099-B: no number, says why', missing(fed({ wages: [W2], trades: [trade({ costBasis: null })] })), ['Your 1099-B doesn’t show the cost basis (box 1e), so your gain can’t be worked out.'])
check('a 1042-S for trading: no number, says why', missing(fed({ wages: [W2], trades: [trade({ form: '1042-S', incomeCode: '36', costBasis: null })] })), ['The estimate doesn’t work out a 1042-S for trading yet.'])
check('two 1099-B forms: gains and losses net first ($250 gain + $100 loss = $150)', line(fed({ wages: [W2], trades: [trade(), trade({ proceeds: D(900), costBasis: D(1_000) })] }), 'trading'), D(150))

console.log('\nMINE: India and China (as they work now), and a scholarship alongside\n')
check('lived in India, taxed dividends: no number (its treaty may set a lower rate)', missing(fed({ wages: [W2], investments: [div1042()] }, 'IN')), ['You lived in India before coming to the U.S. Its tax treaty with the U.S. may set a lower rate on your dividends or interest, and the estimate doesn’t cover that yet.'])
check('lived in China, 1099-DIV: no number either', fed({ wages: [W2], investments: [div1099()] }, 'CN').status, 'not-calculated')
check('lived in India, only exempt interest: nothing at a treaty rate, so a number (with the India deduction)', [fed({ wages: [W2], investments: [div1042({ incomeCode: '29', exemptionCode: '02', taxRate: '00.00', withheld: 0, gross: D(80) })] }, 'IN').status, line(fed({ wages: [W2], investments: [div1042({ incomeCode: '29', exemptionCode: '02', taxRate: '00.00', withheld: 0, gross: D(80) })] }, 'IN'), 'deduction')], ['refund', D(15_750)])
const withSch = fed({ wages: [W2], investments: [div1042()], scholarships: [{ itemId: 'scholarship', payer: 'Sample University', incomeCode: '16', gross: D(9_000), exemptionCode: '00', taxRate: '14.00', withheld: D(1_260) }], scholarshipUse: { paidFor: 'tuition', stipend: null } })
check('a scholarship 1042-S and an investment 1042-S: line 25g adds both box 10s ($1,260 + $420)', [line(withSch, 'withheld-1042s'), isCalculated(withSch) && withSch.lines.find((l) => l.id === 'withheld-1042s')?.label], [D(1_680), 'Tax withheld on your 1042-S forms'])

console.log('\nMINE: the state estimate shows no number\n')
check('New York with dividends: not calculated, says why', missing(estimateReturn(input({ wages: [W2], investments: [div1042()] })).state), ['We can’t include your investment income in the state estimate yet.'])
check('New York with trading: not calculated, says why', missing(estimateReturn(input({ wages: [W2], trades: [trade()] })).state), ['We can’t include your trading in the state estimate yet.'])

console.log('\nMINE: “Show how we got this”, citations, the download, and “Show estimate number” off\n')
const full = fed({ wages: [W2], investments: [div1042(), div1099()], trades: [trade()] })
check('every new line is in the breakdown, in order', isCalculated(full) && full.lines.map((l) => l.id), ['wages', 'dividends', 'trading', 'total-income', 'deduction', 'taxable', 'tax', 'nec-tax', 'total-tax', 'withheld', 'withheld-1099', 'withheld-1042s', 'total-payments', 'result'])
check('every line names its form line and an IRS source with a page', isCalculated(full) && full.lines.every((l) => !!l.formLine && /(Publication 519|Instructions for Form 10(40|42)(-NR|-S)?|Form 1040-NR) \(2025\)(, (page|pages) \d|$|;)/.test(l.source ?? '')), true)
check('"Figures used" cites Pub 519 pages 30, 32, 20 and 65, and the 1040-NR instructions pages 42 to 44', isCalculated(full) && ['Publication 519 (2025), pages 30 and 31', 'Publication 519 (2025), page 32', 'Publication 519 (2025), page 20', 'page 65 (Arthur Banks)', 'Instructions for Form 1040-NR (2025), page 43', 'Instructions for Form 1040-NR (2025), page 44', 'Instructions for Form 1042-S (2025)'].map((c) => full.sources.some((s) => s.citation.includes(c))), [true, true, true, true, true, true, true])
// 1042-S 1,400 + 1099-DIV 118.40 = 1,518.40 → $1,518 × 30% = 455.40 → $455; tax 4,379; total 4,834; 25a 3,186, 25b 18, 25g 420 → 3,624; owes 1,210
const nr = build1040NR({ docs: [], estimate: estimateReturn(input({ wages: [W2], investments: [div1042(), div1099()], trades: [trade()] })) })
check('the 1040-NR: 23a and 23d $455, 24 $4,834, 25b $18, 25d $3,204, 25g $420, 33 $3,624, owes $1,210', [F1040NR.line23a, F1040NR.line23d, F1040NR.line24, F1040NR.line25b, F1040NR.line25d, F1040NR.line25g, F1040NR.line33, F1040NR.line37].map((n) => nr.values[n]), ['455', '455', '4,834', '18', '3,204', '420', '3,624', '1,210'])
check('…and the last page says Schedule NEC isn’t included and why the trading isn’t entered', ['Schedule NEC (Form 1040-NR), with your dividends and interest', 'Your trading is not entered'].map((x) => nr.notIncluded.some((n) => n.includes(x))), [true, true])
const pdf = await PDFDocument.load(await renderForm(nr, 2025))
check('…and those lines really land in the official PDF (rendered and read back)', [F1040NR.line23a, F1040NR.line25b, F1040NR.line25g, F1040NR.line24].map((n) => pdf.getForm().getTextField(n).getText()), ['455', '18', '420', '4,834'])
const hidden = JSON.stringify(hideNumbers(estimateReturn(input({ wages: [W2], investments: [div1042(), div1099()], trades: [trade()] }))).federal).replace(/"citation":"[^"]*"/g, '')
check('number off: none of the new amounts is sent (cents or dollars)', /140000|45500|483400|362400|25000|1,518|4,834|3,624|1,210/.test(hidden), false)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll investment checks passed.')
process.exit(failed ? 1 : 0)
