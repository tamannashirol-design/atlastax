// Checks the 2025 student treaty benefits (src/tax/treaty.ts, federal.ts, years/treaties-2025.ts):
// India (standard deduction) and China (wage exemption), federal estimate only.
// Run: npm run check:treaty
//
// Two kinds of case, labelled in the output:
//   OFFICIAL  the expected answer comes from an IRS publication (not from our code)
//   MINE      a synthetic case I made up; the expected answer is worked out by hand in the comment
import { estimateReturn, hideNumbers, isCalculated, RESULT_NOTES, type Section } from '../src/tax/estimate.ts'
import { buildTaxInput, type TaxInput } from '../src/tax/input.ts'
import { treatyFor } from '../src/tax/treaty.ts'
import { YEAR_2025 } from '../src/tax/years/2025.ts'
import { CHINA, INDIA } from '../src/tax/years/treaties-2025.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const D = (n: number) => n * 100
const wage = (wagesCents: number, withheldCents: number, state = 'NY') => ({ itemId: 'opt-cpt', employer: 'Sample Employer Inc. (FAKE)', wages: wagesCents, federalWithheld: withheldCents, stateCode: state, stateWages: wagesCents, stateWithheld: D(1_893) })
const base = buildTaxInput({ year: 2025, person: {}, income: ['opt-cpt'], items: [], documents: [] })
// `lived`: the answer to "Where did you live before coming to the U.S.?" (the treaty goes by this). Citizenship is set
// to something else on purpose (Brazil), to show it is not what decides.
const input = (lived: string | null, over: Partial<TaxInput> = {}, visa: string | null = 'F-1'): TaxInput => ({ ...base, person: { citizenship: 'BR', visa, livedBefore: lived, marital: null, digitalAssets: null }, ...over })
const est = (citizenship: string | null, wagesCents: number, withheldCents: number, over: Partial<TaxInput> = {}, visa: string | null = 'F-1') => estimateReturn(input(citizenship, { wages: [wage(wagesCents, withheldCents)], ...over }, visa))
const line = (s: Section, id: string) => (isCalculated(s) ? (s.lines.find((l) => l.id === id)?.amount ?? NaN) : NaN)
const summary = (s: Section) => (isCalculated(s) ? [s.status, s.amount, line(s, 'wages'), line(s, 'deduction'), line(s, 'taxable'), line(s, 'tax')] : [s.status])

// ---------------------------------------------------------------------------------------------
console.log('OFFICIAL: the figures (Publication 519 and Publication 901)\n')
check('India: single standard deduction $15,750 (Publication 519 (2025), Worksheet 5-1, line 1, page 40)', INDIA.standardDeductionSingle, 15_750)
check('China: up to $5,000 of personal services income per tax year (Publication 901, page 30; Publication 519, page 80)', CHINA.exemptWagesPerYear, 5_000)
check('articles as the publications name them: India Article 21(2) (Pub 519, page 39), China Article 20 (Pub 519, page 67)', [INDIA.article, CHINA.article], ['Article 21(2)', 'Article 20'])
check('only India and China have a treaty benefit', Object.keys(YEAR_2025.treaties).sort(), ['CN', 'IN'])
check('the treaty does not apply to Hong Kong (Publication 901, page 2): Hong Kong, Taiwan and Macau get nothing', ['HK', 'TW', 'MO'].map((c) => treatyFor(input(c), YEAR_2025)), [null, null, null])

console.log('\nOFFICIAL: India: the standard deduction (Publication 519 (2025), pages 39 and 40)\n')
check('wages at or above $15,750: the deduction is exactly $15,750', [20_000, 15_750, 100_000].map((w) => line(est('IN', D(w), 0).federal, 'deduction')), [D(15_750), D(15_750), D(15_750)])
check('it is entered on Form 1040-NR line 12, labelled as the treaty deduction, with its page', (() => { const l = (est('IN', D(38_450), 0).federal as { lines: { id: string; label: string; formLine?: string; from?: string; source?: string; amount: number }[] }).lines.find((x) => x.id === 'deduction')!; return [l.label, l.formLine, l.from, l.source, l.amount] })(), ['Standard deduction (India treaty)', 'Form 1040-NR, line 12', 'Student, U.S.–India treaty, Article 21(2)', 'Publication 519 (2025), pages 39 and 40', D(15_750)])

console.log('\nOFFICIAL: China: the wage exemption (Publication 901, page 30; Instructions for Form 1040-NR (2025), page 18)\n')
check('wages above $5,000: exactly $5,000 is exempt; below it, all of it', [20_000, 5_000, 3_000, 0].map((w) => line(est('CN', D(w), 0).federal, 'treaty')), [D(5_000), D(5_000), D(3_000), 0])
// The instructions' Example 2 (page 18): a $8,000 W-2, $5,000 exempt: "report $3,000 on line 1a, include $5,000 on line 1k".
// (That example is about France's $5,000; China's is the same size and the mechanics are the same.)
const ex2 = est('CN', D(8_000), 0).federal
check('the IRS’s Example 2 (W-2 box 1 $8,000, $5,000 exempt): line 1a = $3,000, line 1k = $5,000', [line(ex2, 'wages-w2'), line(ex2, 'wages'), line(ex2, 'treaty')], [D(8_000), D(3_000), D(5_000)])
check('line 1a is the wages minus the exemption, and the treaty amount is shown on line 1k', (ex2 as { lines: { id: string; formLine?: string }[] }).lines.filter((l) => ['wages', 'treaty'].includes(l.id)).map((l) => [l.id, l.formLine]), [['treaty', 'Form 1040-NR, line 1k'], ['wages', 'Form 1040-NR, line 1a']])

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: India (worked out by hand)\n')
// the fake W-2: wages 38,450, federal withheld 3,186. Deduction 15,750 → taxable 22,700 → Tax Table row 22,700–22,750, middle 22,725: 1,192.50 + 12% × (22,725 − 11,925 = 10,800 → 1,296) = 2,488.50 → $2,489. Refund 3,186 − 2,489 = 697.
check('India, the fake W-2: deduction $15,750, taxable $22,700, tax $2,489, refund $697', summary(est('IN', D(38_450), D(3_186)).federal), ['refund', D(697), D(38_450), D(15_750), D(22_700), D(2_489)])
check('…compared with no treaty: tax $4,379, owes $1,193', summary(est('FR', D(38_450), D(3_186)).federal), ['owed', D(1_193), D(38_450), 0, D(38_450), D(4_379)])
check('wages under $15,750: the deduction is the wages, taxable $0, no tax, everything withheld comes back', summary(est('IN', D(10_000), D(300)).federal), ['refund', D(300), D(10_000), D(10_000), 0, 0])
// wages 120,000: taxable 104,250 → the worksheet (over 100,000), row over 103,350: 24% × 104,250 − 7,153 = 25,020 − 7,153 = 17,867
check('India, $100,000 or more of taxable income uses the worksheet: wages $120,000: tax $17,867', line(est('IN', D(120_000), 0).federal, 'tax'), D(17_867))

console.log('\nMINE: China (worked out by hand)\n')
// the fake W-2: wages 38,450 − 5,000 = 33,450 → Tax Table row 33,450–33,500, middle 33,475: 1,192.50 + 12% × (33,475 − 11,925 = 21,550 → 2,586) = 3,778.50 → $3,779. Withheld 3,186 → owes 593.
check('China, the fake W-2: $5,000 exempt, wages counted $33,450, tax $3,779, owes $593', summary(est('CN', D(38_450), D(3_186)).federal), ['owed', D(593), D(33_450), 0, D(33_450), D(3_779)])
check('China, wages $3,000: all exempt, nothing counted, no tax, everything withheld comes back', summary(est('CN', D(3_000), D(200)).federal), ['refund', D(200), 0, 0, 0, 0])
// two W-2s of $3,000.40 each: 6,000.80 → $6,001 → exempt 5,000 → counted $1,001
check('two W-2s: the wages are added and rounded first, then the $5,000 comes off', [line(est('CN', 0, 0, { wages: [wage(300_040, 0), wage(300_040, 0)] }).federal, 'wages-w2'), line(est('CN', 0, 0, { wages: [wage(300_040, 0), wage(300_040, 0)] }).federal, 'wages')], [D(6_001), D(1_001)])
check('China has no standard deduction: deductions stay "not included yet"', (est('CN', D(38_450), 0).federal as { lines: { id: string; from?: string }[] }).lines.find((l) => l.id === 'deduction')?.from, 'Not included yet')
check('India has no wage exemption: no treaty line, wages are the W-2 wages', [(est('IN', D(38_450), 0).federal as { lines: { id: string }[] }).lines.some((l) => l.id === 'treaty'), line(est('IN', D(38_450), 0).federal, 'wages')], [false, D(38_450)])

console.log('\nMINE: who gets it (the citizenship the person gave, and a student visa)\n')
check('India and China, any letter case', [treatyFor(input('IN'), YEAR_2025)?.code, treatyFor(input('cn'), YEAR_2025)?.code, treatyFor(input(' in '), YEAR_2025)?.code], ['IN', 'CN', 'IN'])
check('any other country, or none given: no treaty', ['FR', 'GB', 'KR', 'CA', 'MX', 'DE', null, ''].map((c) => treatyFor(input(c), YEAR_2025)), [null, null, null, null, null, null, null, null])
check('no student visa (or none given): no treaty', [null, 'B-2', 'H-1B'].map((v) => treatyFor(input('IN', {}, v), YEAR_2025)), [null, null, null])
check('F-1, J-1 and M-1 all count', ['F-1', 'J-1', 'M-1'].map((v) => treatyFor(input('CN', {}, v), YEAR_2025)?.code), ['CN', 'CN', 'CN'])
check('a tax year with no verified figures (2024): nothing calculated, so no treaty', est('IN', D(38_450), 0, { year: 2024 }).federal.status, 'not-supported')

console.log('\nMINE: where you lived decides, not citizenship\n')
const person = (citizenship: string | null, livedBefore: string | null) => ({ citizenship, visa: 'F-1', livedBefore, marital: null, digitalAssets: null })
check('an Indian citizen who lived in the U.K. before coming: no India treaty', treatyFor({ ...base, person: person('IN', 'GB') }, YEAR_2025), null)
check('a British citizen who lived in India before coming: the India treaty', treatyFor({ ...base, person: person('GB', 'IN') }, YEAR_2025)?.code, 'IN')
check('a Chinese citizen who lived in Hong Kong before coming: no China treaty (it doesn’t cover Hong Kong)', treatyFor({ ...base, person: person('CN', 'HK') }, YEAR_2025), null)
check('citizenship India, the "lived before" question not answered: no treaty (nothing is assumed)', treatyFor({ ...base, person: person('IN', null) }, YEAR_2025), null)
check('the numbers follow: British citizen who lived in India gets the $15,750 deduction; Indian citizen who lived in the U.K. does not', [line(estimateReturn({ ...base, person: person('GB', 'IN'), wages: [wage(D(38_450), 0)] }).federal, 'deduction'), line(estimateReturn({ ...base, person: person('IN', 'GB'), wages: [wage(D(38_450), 0)] }).federal, 'deduction')], [D(15_750), 0])

console.log('\nMINE: the notes\n')
check('India: "Treaty benefits aren’t included yet." goes away, and no "assumes you lived in India" note replaces it', est('IN', D(38_450), 0).notes, [RESULT_NOTES[0]])
check('China: the same', est('CN', D(38_450), 0).notes, [RESULT_NOTES[0]])
check('no note anywhere mentions an assumption about where you lived', [est('IN', D(38_450), 0).notes, est('CN', D(38_450), 0).notes].flat().some((n) => /resident of|lived in|assumes you/i.test(n)), false)
check('every other country keeps both notes', [est('FR', D(38_450), 0).notes, est(null, D(38_450), 0).notes], [[...RESULT_NOTES], [...RESULT_NOTES]])
check('India or China without a student visa keep both notes', est('IN', D(38_450), 0, {}, 'B-2').notes, [...RESULT_NOTES])
const blocked = buildTaxInput({ year: 2025, person: {}, income: [], items: [{ id: 'passport', kind: 'document', label: 'Passport', status: 'missing' }], documents: [] })
check('no federal number (something unconfirmed): still no treaty note for India', estimateReturn({ ...blocked, person: person('BR', 'IN'), wages: [wage(D(38_450), 0)] }).notes, [RESULT_NOTES[0]])
check('marital status answered single: "Assumes single filing status." goes too (nothing is assumed)', [estimateReturn(input('IN', { wages: [wage(D(38_450), 0)], person: { ...person('BR', 'IN'), marital: 'single' } })).notes, estimateReturn(input('FR', { wages: [wage(D(38_450), 0)], person: { ...person('BR', 'FR'), marital: 'single' } })).notes], [[], [RESULT_NOTES[1]]])
check('the treaty assumptions no longer include where you lived (it is asked now)', [...INDIA.assumptions, ...CHINA.assumptions].some((x) => /resident of/i.test(x)), false)

console.log('\nMINE: federal only: the state numbers do not change\n')
check('New York: identical with or without the treaty', [JSON.stringify(est('IN', D(38_450), D(3_186)).state) === JSON.stringify(est('FR', D(38_450), D(3_186)).state), JSON.stringify(est('CN', D(38_450), D(3_186)).state) === JSON.stringify(est('FR', D(38_450), D(3_186)).state)], [true, true])
check('California: identical too', JSON.stringify(estimateReturn(input('IN', { wages: [wage(D(38_450), 0, 'CA')] })).state) === JSON.stringify(estimateReturn(input('FR', { wages: [wage(D(38_450), 0, 'CA')] })).state), true)
check('the state still starts from the full W-2 wages (NY wages line = $38,450 for a China student)', line(est('CN', D(38_450), 0).state, 'state-wages'), D(38_450))

console.log('\nMINE: citations, and "Show estimate number" off\n')
const lineHas = (s: Section, id: string) => isCalculated(s) && !!s.lines.find((l) => l.id === id)?.formLine && /Publication (901|519)|Instructions for Form 1040-NR/.test(s.lines.find((l) => l.id === id)?.source ?? '')
check('the treaty lines name their IRS publication and page', [lineHas(est('CN', D(38_450), 0).federal, 'treaty'), lineHas(est('IN', D(38_450), 0).federal, 'deduction')], [true, true])
check('"Figures used" for India cites Publication 519 pages 39 and 40 and Publication 901 pages 33 and 34', (est('IN', D(38_450), 0).federal as { sources: { citation: string }[] }).sources.map((s) => s.citation).join(' ').match(/Publication 519 \(2025\), page 39|page 40, Worksheet 5-1|Publication 901 \(Rev\. 9-2024\), pages 33 and 34/g), ['Publication 519 (2025), page 39', 'page 40, Worksheet 5-1', 'Publication 901 (Rev. 9-2024), pages 33 and 34'])
check('"Figures used" for China cites Publication 901 page 30, Publication 519 page 80, and the 1040-NR instructions page 18', (est('CN', D(38_450), 0).federal as { sources: { citation: string }[] }).sources.map((s) => s.citation).join(' ').match(/Publication 901 \(Rev\. 9-2024\), page 30|Publication 519 \(2025\), page 80|Instructions for Form 1040-NR \(2025\), page 18/g), ['Publication 901 (Rev. 9-2024), page 30', 'Publication 519 (2025), page 80', 'Instructions for Form 1040-NR (2025), page 18'])
check('what the publications don’t give as a number (the time limits) is marked TODO confirm with CPA, and not enforced', [INDIA.sources.conditions.citation, CHINA.sources.reporting.citation].map((c) => c.includes('TODO confirm with CPA')), [true, true])
check('the assumptions we can’t check are listed for both', [INDIA.assumptions.length >= 2, CHINA.assumptions.length >= 2], [true, true])
for (const cit of ['IN', 'CN']) {
  const hidden = hideNumbers(est(cit, D(38_450), D(3_186)))
  check(`${cit}: with the number off, no amount of this person’s remains anywhere (cents or dollars)`, /3845000|3345000|1575000|2270000|500000|248900|377900|59300|69700|318600|38,?450|33,?450|22,?700|2,?489|3,?779|3,?186/.test(JSON.stringify(hidden)), false)
}
check('no ID numbers or file names in the estimate', /\d{3}-\d{2}-\d{4}|\d{2}-\d{7}|X1234567|\.pdf|\.jpg|\.png/i.test(JSON.stringify(est('IN', D(38_450), D(3_186)))), false)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll treaty checks passed.')
process.exit(failed ? 1 : 0)
