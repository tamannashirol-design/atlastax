// The federal estimate for ONE kind of return: nonresident, single, no itemized deductions yet.
// Income it works out: W-2 wages, U.S. bank interest from a 1099-INT (exempt: shown, never taxed), a
// scholarship on a 1042-S (only the taxable part), dividends and interest on a 1042-S or 1099-DIV (the flat 30%,
// Schedule NEC → line 23a) and trading on a 1099-B (the 183-day rule). Treaty benefits: only the India student standard deduction
// and the China student wage exemption (src/tax/treaty.ts). Anything else gives NO number and a plain message
// (never a guess). Pure. Reads the confirmed values as `TaxInput` (src/tax/input.ts, R1) and the year's figures
// from src/tax/years/* (bank interest and scholarship rules: years/income-2025.ts, each with its IRS page).
import { federalTax, roundToDollars } from './engine.ts'
import type { Calculated, EstimateLine, NotCalculated, NotSupported, Source } from './estimate.ts'
import type { TaxInput } from './input.ts'
import { noNumberReasons } from './stops.ts'
import { treatyFor } from './treaty.ts'
import { yearConfig } from './years/index.ts'

const cents = (dollars: number) => dollars * 100
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const noNumber = (...missing: string[]): NotCalculated => ({ status: 'not-calculated', missing })
/** Cents to whole dollars, for amounts that can be below zero (a net loss) */
const signedDollars = (c: number) => (c < 0 ? -roundToDollars(-c) : roundToDollars(c))
const rateOf = (text: string | null) => (text === null || text === '' ? NaN : Number(text))

/** The taxable part of the scholarship (whole dollars), from box 2 and what it paid for. Never more than box 2. */
export function taxableScholarship(gross: number, use: TaxInput['scholarshipUse']): number {
  if (use.paidFor === 'tuition') return 0 // all of it for qualified expenses (Pub 519 pages 24–25)
  if (use.paidFor === 'living') return gross // none of it for qualified expenses
  if (use.paidFor === 'both') return Math.min(gross, roundToDollars(use.stipend ?? 0)) // the part for living costs
  return gross
}

export function federalSection(input: TaxInput): Calculated | NotCalculated | NotSupported {
  const cfg = yearConfig(input.year)
  if (!cfg) return { status: 'not-supported', message: 'We can’t estimate this tax year yet.' }
  const I = cfg.income

  // 1. Something the person still has to confirm (or answer)
  // 1b. An answer that means no number yet (married, digital assets): say why (src/tax/stops.ts)
  const stops = noNumberReasons(input)
  if (input.blockers.length || stops.length) return noNumber(...(input.blockers.length ? ['Waiting for the items listed above.'] : []), ...stops)

  // 2. Income the engine can't handle: no number, and say which
  if (input.other.length) {
    const names = [...new Set(input.other.map((o) => o.label))]
    return noNumber(...names.map((n) => `We can’t include ${n} in the estimate yet.`))
  }

  // 3. A 1042-S or 1099-INT the rules here don't cover: no number, and say why (TODO confirm with CPA, each one)
  for (const s of input.scholarships) {
    if (s.incomeCode !== I.scholarshipIncomeCode) return noNumber(`Your 1042-S shows income code ${s.incomeCode || '(none)'} in box 1, not a scholarship (code ${I.scholarshipIncomeCode}). The estimate can’t include it yet.`)
    if (!I.notExemptCodes.includes(s.exemptionCode)) return noNumber(`Your 1042-S shows exemption code ${s.exemptionCode} in box 3a. The estimate doesn’t work out a scholarship that is claimed as exempt yet.`)
  }
  if (input.bankInterest.some((b) => b.withheld > 0)) return noNumber('Your bank withheld federal tax from your interest (box 4 of your 1099-INT). The estimate doesn’t credit that yet.')

  // 3b. Dividends and interest (Schedule NEC): only the general 30% rate, or interest that is exempt (TODO confirm with CPA, each one)
  const exemptInterestOf = (i: TaxInput['investments'][number]) => i.form === '1042-S' && rateOf(i.taxRate) === 0 && I.exemptInterest.find((e) => e.incomeCode === i.incomeCode && e.exemptionCode === i.exemptionCode)
  for (const i of input.investments) {
    if (i.form !== '1042-S' || exemptInterestOf(i)) continue
    if (![...I.dividendCodes, ...I.interestCodes].includes(i.incomeCode ?? '')) return noNumber(`Your investment 1042-S shows income code ${i.incomeCode || '(none)'} in box 1. The estimate only works out dividends (code 06) and interest (code 01) yet.`)
    if (!I.notExemptCodes.includes(i.exemptionCode)) return noNumber(`Your investment 1042-S shows exemption code ${i.exemptionCode} in box 3a. The estimate doesn’t work that out yet.`)
    if (rateOf(i.taxRate) !== I.necRatePercent) return noNumber(`Your investment 1042-S shows a ${i.taxRate ?? 'missing'} rate in box 3b. A rate other than 30% comes from a tax treaty, which the estimate doesn’t cover yet.`)
  }
  // 3c. Trading: the 183-day rule (Pub 519 p. 32), with the days from Time in the U.S.
  if (input.trades.some((t) => t.form === '1042-S')) return noNumber('The estimate doesn’t work out a 1042-S for trading yet.')
  if (input.trades.some((t) => t.costBasis === null)) return noNumber('Your 1099-B doesn’t show the cost basis (box 1e), so your gain can’t be worked out.')
  const netGain = signedDollars(input.trades.reduce((n, t) => n + t.proceeds - (t.costBasis ?? 0), 0)) // gains minus losses
  const days = input.person.daysInUS
  if (input.trades.length && netGain > 0) {
    if (days === null) return noNumber(`To check the 183-day rule for your trading gains we need the days you were in the U.S. in ${input.year}. Finish “Time in the U.S.” first.`)
    if (days >= I.capitalGainDays) return noNumber(`You were in the U.S. ${days} days in ${input.year}, so your trading gains may be taxed. That depends on where your tax home was, which we don’t ask yet.`)
  }

  // 4. Nothing to calculate from
  if (!input.wages.length && !input.scholarships.length && !input.bankInterest.length && !input.investments.length && !input.trades.length) return noNumber('There’s no W-2 to calculate from.')

  // Add the cents first, round only the totals (Instructions for Form 1040, "Rounding Off to Whole Dollars")
  const w2Wages = roundToDollars(input.wages.reduce((n, w) => n + w.wages, 0))
  const withheld = roundToDollars(input.wages.reduce((n, w) => n + w.federalWithheld, 0))
  const interest = roundToDollars(input.bankInterest.reduce((n, b) => n + b.interest, 0))
  const grossScholarship = roundToDollars(input.scholarships.reduce((n, s) => n + s.gross, 0))
  const investment1042 = input.investments.filter((i) => i.form === '1042-S')
  const withheld1042 = roundToDollars(input.scholarships.reduce((n, s) => n + s.withheld, 0) + investment1042.reduce((n, i) => n + i.withheld, 0)) // line 25g: every 1042-S
  const withheld1099 = roundToDollars(input.investments.filter((i) => i.form === '1099-DIV').reduce((n, i) => n + i.withheld, 0) + input.trades.reduce((n, t) => n + t.withheld, 0)) // line 25b
  // Schedule NEC column (c), 30%: dividends (1099-DIV, 1042-S code 06) and interest (1042-S code 01); exempt interest apart
  const isDividend = (i: TaxInput['investments'][number]) => i.form === '1099-DIV' || I.dividendCodes.includes(i.incomeCode ?? '')
  const taxedInvestments = input.investments.filter((i) => !exemptInterestOf(i))
  const dividends = roundToDollars(taxedInvestments.filter(isDividend).reduce((n, i) => n + i.gross, 0))
  const necInterest = roundToDollars(taxedInvestments.filter((i) => !isDividend(i)).reduce((n, i) => n + i.gross, 0))
  const exemptInterest = roundToDollars(input.investments.filter((i) => exemptInterestOf(i)).reduce((n, i) => n + i.gross, 0))
  const necIncome = dividends + necInterest // Schedule NEC line 13, column (c)
  const necTax = roundToDollars(necIncome * I.necRatePercent) // dollars × percent = cents → line 14 → 15 → Form 1040-NR line 23a
  const scholarship = input.scholarships.length ? taxableScholarship(grossScholarship, input.scholarshipUse) : 0

  // Student treaty benefit, from the country lived in before the U.S. (src/tax/treaty.ts). Federal only, and only as
  // it works for wages: the China exemption is for pay for personal services, the India deduction for any income.
  const treaty = treatyFor(input, cfg)
  // China's treaty also covers grants from educational organizations (Pub 901 (9-2024), page 30), which this estimate
  // doesn't apply: a taxable scholarship would be overstated, so no number (TODO confirm with CPA)
  if (treaty?.code === 'CN' && scholarship > 0) return noNumber('You lived in China before coming to the U.S. The U.S.–China treaty may make your scholarship tax-free, and the estimate doesn’t work that out yet.')
  // A treaty country may set a lower rate on dividends and interest (Instructions for Form 1040-NR (2025), page 42), which the
  // estimate doesn't cover: no number rather than 30% (TODO confirm with CPA)
  if (treaty && necIncome > 0) return noNumber(`You lived in ${treaty.country} before coming to the U.S. Its tax treaty with the U.S. may set a lower rate on your dividends or interest, and the estimate doesn’t cover that yet.`)
  const exempt = treaty?.kind === 'wage-exemption' ? Math.min(w2Wages, treaty.exemptWagesPerYear) : 0
  const wages = w2Wages - exempt // line 1a
  const totalIncome = wages + scholarship // line 9 = 1z + 8 (bank interest is excluded: not on the return)
  // line 12: the India treaty standard deduction; otherwise not included yet (itemized deductions come in R3)
  const deductions = treaty?.kind === 'standard-deduction' ? Math.min(treaty.standardDeductionSingle, totalIncome) : 0
  const taxable = Math.max(0, totalIncome - deductions) // line 15
  const { tax, method } = federalTax(cfg, taxable) // line 16 (= line 24: nothing else is added)
  const totalTax = tax + necTax // line 24 = line 22 + line 23d (23d = 23a here)
  const payments = withheld + withheld1099 + withheld1042 // line 33 = 25d (25a + 25b) + 25g
  const diff = payments - totalTax // line 33 minus line 24
  const S = cfg.sources
  const employer = input.wages.length === 1 ? input.wages[0].employer : null

  const line = (l: Omit<EstimateLine, 'amount'> & { dollars: number }): EstimateLine => {
    const { dollars, ...rest } = l
    return { ...rest, amount: cents(dollars) }
  }
  const fromW2 = !input.wages.length ? 'No W-2' : input.wages.length > 1 ? 'From your W-2s' : employer ? `From your W-2, ${employer}` : 'From your W-2'
  const china = treaty?.kind === 'wage-exemption' ? treaty : null
  const treatyLines: EstimateLine[] = china
    ? [
        line({ id: 'wages-w2', group: 'income', label: 'Wages on your W-2', formLine: 'Form W-2, box 1', from: fromW2, source: 'Instructions for Form 1040-NR (2025), page 17', dollars: w2Wages }),
        line({ id: 'treaty', group: 'income', label: `Less: treaty exemption (${china.country})`, formLine: 'Form 1040-NR, line 1k', from: `Student wages, up to ${usd(china.exemptWagesPerYear)} a year, ${china.article}`, source: 'Publication 901 (9-2024), page 30; Publication 519 (2025), page 80', treaty: true, dollars: exempt }),
      ]
    : []

  const payer = (list: { payer: string | null }[]) => (list.length === 1 && list[0].payer ? `, ${list[0].payer}` : '')
  const interestLines: EstimateLine[] = input.bankInterest.length
    ? [line({ id: 'bank-interest', group: 'income', label: 'Bank interest (not taxed)', formLine: 'Not entered on Form 1040-NR', from: `From your 1099-INT${payer(input.bankInterest)}: exempt for a nonresident`, source: 'Publication 519 (2025), page 22; Instructions for Form 1040-NR (2025), page 19', dollars: interest })]
    : []

  const has1099 = input.investments.some((i) => i.form === '1099-DIV') || input.trades.length > 0
  const has1042 = input.scholarships.length > 0 || investment1042.length > 0
  const investmentLines: EstimateLine[] = [
    ...(taxedInvestments.some(isDividend)
      ? [line({ id: 'dividends', group: 'income', label: 'Dividends (taxed at 30%)', formLine: 'Schedule NEC, line 1a, column (c)', from: input.investments.some((i) => i.form === '1099-DIV') ? 'From your 1099-DIV, box 1a' : 'From your 1042-S, income code 06', source: 'Instructions for Form 1040-NR (2025), page 43; Publication 519 (2025), page 30', dollars: dividends })]
      : []),
    ...(taxedInvestments.some((i) => !isDividend(i))
      ? [line({ id: 'nec-interest', group: 'income', label: 'Interest (taxed at 30%)', formLine: 'Schedule NEC, lines 2a to 2c, column (c)', from: 'From your 1042-S, income code 01', source: 'Instructions for Form 1040-NR (2025), page 43; Publication 519 (2025), page 30', dollars: necInterest })]
      : []),
    ...(input.investments.some((i) => exemptInterestOf(i))
      ? [line({ id: 'investment-interest-exempt', group: 'income', label: 'Interest (not taxed)', formLine: 'Not taxed (a Schedule NEC exception)', from: 'Deposit or portfolio interest on your 1042-S', source: 'Publication 519 (2025), page 22; Instructions for Form 1040-NR (2025), page 43', dollars: exemptInterest })]
      : []),
    ...(input.trades.length
      ? [line({ id: 'trading', group: 'income', label: netGain > 0 ? 'Trading gains (not taxed)' : 'Trading: no net gain', formLine: 'Schedule NEC, lines 16 to 18: not entered', from: netGain > 0 ? `In the U.S. ${days} days in ${input.year}: fewer than ${I.capitalGainDays}` : 'Losses beyond gains aren’t allowed', source: 'Publication 519 (2025), page 32; Instructions for Form 1040-NR (2025), page 44', dollars: Math.max(0, netGain) })]
      : []),
  ]

  const use = input.scholarshipUse.paidFor
  const excluded = grossScholarship - scholarship
  const scholarshipLines: EstimateLine[] = input.scholarships.length
    ? [
        line({ id: 'scholarship-1042s', group: 'income', label: 'Scholarship on your 1042-S', formLine: 'Form 1042-S, box 2', from: `From your 1042-S${payer(input.scholarships)}`, source: 'Instructions for Form 1042-S (2025), page 25', dollars: grossScholarship }),
        ...(excluded > 0
          ? [line({ id: 'scholarship-excluded', group: 'income', label: 'Less: tuition, fees and books', formLine: 'Not taxed', from: use === 'tuition' ? 'You told us it paid for tuition, fees and books' : 'The part that wasn’t for living costs', source: 'Publication 519 (2025), pages 24 and 25', dollars: excluded })]
          : []),
        line({
          id: 'scholarship',
          group: 'income',
          label: 'Taxable scholarship',
          formLine: 'Schedule 1, line 8r → Form 1040-NR, line 8',
          from: use === 'tuition' ? 'None: it paid for tuition, fees and books' : use === 'both' ? 'The part you told us was for living costs' : 'You told us it paid for living costs',
          source: 'Instructions for Form 1040-NR (2025), page 31; Publication 519 (2025), page 26',
          dollars: scholarship,
        }),
      ]
    : []

  const totalFrom = input.scholarships.length ? (wages ? 'Wages plus the taxable scholarship' : 'The taxable scholarship') : 'Wages are the only income counted'
  const lines: EstimateLine[] = [
    ...treatyLines,
    line({
      id: 'wages',
      group: 'income',
      label: china ? 'Wages counted' : 'Wages',
      formLine: 'Form 1040-NR, line 1a',
      from: china ? 'W-2 wages minus the treaty exemption' : fromW2,
      source: china ? 'Instructions for Form 1040-NR (2025), page 18' : 'Instructions for Form 1040-NR (2025), page 17',
      dollars: wages,
    }),
    ...scholarshipLines,
    ...interestLines,
    ...investmentLines,
    line({ id: 'total-income', group: 'income', label: 'Total income', formLine: 'Form 1040-NR, line 9', from: totalFrom, source: 'Form 1040-NR (2025), page 1', dollars: totalIncome }),
    treaty?.kind === 'standard-deduction'
      ? line({ id: 'deduction', group: 'deductions', label: `Standard deduction (${treaty.country} treaty)`, formLine: 'Form 1040-NR, line 12', from: `Student, U.S.–${treaty.country} treaty, ${treaty.article}`, source: 'Publication 519 (2025), pages 39 and 40', treaty: true, dollars: deductions })
      : line({ id: 'deduction', group: 'deductions', label: 'Deductions', formLine: 'Form 1040-NR, line 12', from: 'Not included yet', source: 'Instructions for Form 1040-NR (2025), page 20', dollars: deductions }),
    line({ id: 'taxable', group: 'deductions', label: 'Taxable income', formLine: 'Form 1040-NR, line 15', source: 'Form 1040-NR (2025), page 2', dollars: taxable }),
    line({
      id: 'tax',
      group: 'tax',
      label: 'Tax',
      formLine: 'Form 1040-NR, line 16',
      from: method === 'table' ? 'From the 2025 Tax Table, Single column' : 'From the Tax Computation Worksheet, Single',
      source: method === 'table' ? 'Instructions for Form 1040 (2025), pages 68–79' : 'Instructions for Form 1040 (2025), page 80',
      dollars: tax,
    }),
    ...(necIncome > 0
      ? [
          line({ id: 'nec-tax', group: 'tax', label: 'Tax on dividends and interest (30%)', formLine: 'Form 1040-NR, line 23a', from: 'Schedule NEC, line 15', source: 'Instructions for Form 1040-NR (2025), page 42; Form 1040-NR (2025), page 2', dollars: necTax }),
          line({ id: 'total-tax', group: 'tax', label: 'Total tax', formLine: 'Form 1040-NR, line 24', from: 'Lines 16 and 23a', source: 'Form 1040-NR (2025), page 2', dollars: totalTax }),
        ]
      : []),
    line({ id: 'withheld', group: 'payments', label: 'Federal tax withheld', formLine: 'Form 1040-NR, line 25a', from: !input.wages.length ? 'No W-2' : input.wages.length > 1 ? 'From your W-2s, box 2' : 'From your W-2, box 2', source: 'Instructions for Form 1040-NR (2025), page 22', dollars: withheld }),
    ...(has1099 ? [line({ id: 'withheld-1099', group: 'payments', label: 'Tax withheld on your 1099 forms', formLine: 'Form 1040-NR, line 25b', from: 'From your 1099-DIV or 1099-B, box 4', source: 'Instructions for Form 1040-NR (2025), page 22', dollars: withheld1099 })] : []),
    ...(has1042 ? [line({ id: 'withheld-1042s', group: 'payments', label: investment1042.length ? 'Tax withheld on your 1042-S forms' : 'Tax withheld from your scholarship', formLine: 'Form 1040-NR, line 25g', from: 'From your 1042-S, box 10', source: 'Instructions for Form 1040-NR (2025), page 22; Instructions for Form 1042-S (2025), page 29', dollars: withheld1042 })] : []),
    ...(has1099 || has1042 ? [line({ id: 'total-payments', group: 'payments', label: 'Total payments', formLine: 'Form 1040-NR, line 33', from: has1099 && has1042 ? 'Lines 25a, 25b and 25g' : has1099 ? 'Lines 25a and 25b' : 'Lines 25a and 25g', source: 'Form 1040-NR (2025), page 2', dollars: payments })] : []),
    line({
      id: 'result',
      group: 'result',
      label: diff > 0 ? 'Refund' : diff < 0 ? 'Amount owed' : 'No refund, nothing owed',
      formLine: diff >= 0 ? 'Form 1040-NR, line 34' : 'Form 1040-NR, line 37',
      from: 'Payments minus tax',
      source: 'Instructions for Form 1040-NR (2025), page 23',
      dollars: Math.abs(diff),
    }),
  ]

  const sources: Source[] = [
    S.wages,
    ...(treaty?.kind === 'wage-exemption' ? [treaty.sources.rule, treaty.sources.amount, treaty.sources.reporting] : []),
    ...(input.scholarships.length ? [I.sources.scholarshipRule, I.sources.scholarshipBox2, I.sources.scholarshipEci, I.sources.scholarshipCodes, I.sources.services] : []),
    ...(input.bankInterest.length ? [I.sources.bankInterest] : []),
    ...(input.investments.length ? [I.sources.nec30, I.sources.necCodes, I.sources.necLines] : []),
    ...(input.investments.some((i) => i.form === '1099-DIV') ? [I.sources.dividends1099] : []),
    ...(input.trades.length ? [I.sources.capitalGains, I.sources.gainSource] : []),
    S.rounding,
    ...(treaty?.kind === 'standard-deduction' ? [treaty.sources.rule, treaty.sources.amount, treaty.sources.conditions] : [S.deductions]),
    S.lineChoice,
    method === 'table' ? S.taxTable : S.worksheet,
    S.brackets,
    S.withheld,
    ...(has1042 ? [I.sources.scholarshipWithheld] : []),
    S.refundOwed,
  ]

  return {
    status: diff > 0 ? 'refund' : diff < 0 ? 'owed' : 'zero',
    amount: cents(Math.abs(diff)),
    lines,
    sources: sources.map((s) => ({ table: s.table, citation: s.citation })),
  }
}
