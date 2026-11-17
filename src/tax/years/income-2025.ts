// TAX YEAR 2025, MORE INCOME: U.S. bank interest and scholarships (Form 1042-S). Every rule and code with its IRS
// source. The ONLY place these rules live (CLAUDE.md: tax rules never sit in components). Read from the IRS documents
// themselves (not from memory) and marked TODO confirm with CPA.
//
// Sources (page numbers are the PDF's own pages, which match the printed ones):
//   P519    = Publication 519, U.S. Tax Guide for Aliens (2025), irs.gov/pub/irs-prior/p519--2025.pdf
//   I1040NR = Instructions for Form 1040-NR (2025), irs.gov/pub/irs-prior/i1040nr--2025.pdf
//   I1042S  = Instructions for Form 1042-S (2025), irs.gov/pub/irs-prior/i1042s--2025.pdf
import type { Source } from '../estimate.ts'

export const TODO_CPA = 'TODO confirm with CPA'

export type IncomeConfig = {
  /** Form 1042-S box 1 income code for scholarship or fellowship grants (I1042S Appendix A, page 36) */
  scholarshipIncomeCode: string
  /**
   * Form 1042-S box 3a: "00" when tax was withheld (box 3b more than 0), blank for backup withholding; a code from 01 to 24
   * means an exemption was claimed (I1042S pages 26 and 37). Only these two cases are worked out; any exemption code gives
   * no number (TODO confirm with CPA: e.g. 04 "Exempt under tax treaty", 02 "Exempt under IRC").
   */
  notExemptCodes: readonly (string | null)[]
  /** The general rate on income not effectively connected (dividends, interest), in whole percent (Pub 519 p. 30) */
  necRatePercent: number
  /** 1042-S box 1 codes worked out at that rate: 06 dividends paid by U.S. corporations, 01 interest paid by U.S. obligors (I1042S page 36) */
  dividendCodes: readonly string[]
  interestCodes: readonly string[]
  /** 1042-S interest that is exempt (rate 00.00): box 1 income code + box 3a exemption code (I1042S pages 36–37; Pub 519 p. 22) */
  exemptInterest: readonly { incomeCode: string; exemptionCode: string; what: string }[]
  /** Capital gains: taxed only with this many days or more in the U.S. in the tax year (Pub 519 p. 32) */
  capitalGainDays: number
  sources: Record<string, Source>
}

export const INCOME_2025: IncomeConfig = {
  scholarshipIncomeCode: '16',
  notExemptCodes: ['00', null],
  necRatePercent: 30,
  dividendCodes: ['06'],
  interestCodes: ['01'],
  exemptInterest: [
    { incomeCode: '29', exemptionCode: '02', what: 'deposit interest' },
    { incomeCode: '01', exemptionCode: '05', what: 'portfolio interest' },
  ],
  // TODO confirm with CPA: Pub 519 counts days "in the United States" for this rule and doesn't say whether days as an
  // exempt individual (a student) count; it only matters at 183 days or more, which gives no number anyway (tax home)
  capitalGainDays: 183,
  sources: {
    nec30: {
      table: 'Dividends and interest: the 30% tax',
      citation:
        'Publication 519 (2025), pages 30 and 31, The 30% Tax: “Tax at a 30% (or lower treaty) rate applies to certain items of income … from U.S. sources but only if the items are not effectively connected”; it applies to the gross amount, and includes interest and dividends. Reported on Schedule NEC (Form 1040-NR), in the column for the rate (column (c) is 30%), and its tax goes to Form 1040-NR line 23a (Form 1040-NR (2025), page 2, line 23a: “from Schedule NEC (Form 1040-NR), line 15”; Instructions for Form 1040-NR (2025), page 42). Pub 519 page 65 (Arthur Banks): dividends of $1,400 × 30% = $420.',
    },
    necCodes: {
      table: 'Dividends and interest: Form 1042-S codes',
      citation:
        'Instructions for Form 1042-S (2025): box 1 income code 06 “Dividends paid by U.S. corporations—general”, 01 “Interest paid by U.S. obligors—general”, 29 “Deposit interest” (Appendix A, page 36); box 3b is the rate withheld, with “00” in box 3a when tax was withheld (page 26); box 3a exemption codes 02 “Exempt under IRC”, 05 “Portfolio interest exempt under IRC” (page 37). A rate other than 30.00 comes from a tax treaty (Instructions for Form 1040-NR (2025), page 42: “The withholding tax rate may be lower … if your country of tax residence and the United States have a treaty”), which this estimate doesn’t cover.',
    },
    necLines: {
      table: 'Dividends and interest: where they go',
      citation:
        'Instructions for Form 1040-NR (2025), page 43: Schedule NEC line 1a, “dividends paid by U.S. corporations”; lines 2a to 2c, interest. Exempt from the 30% tax: “Interest from a U.S. bank, savings and loan association, or similar institution” and “Portfolio interest on obligations issued after July 18, 1984” (also Publication 519 (2025), page 22).',
    },
    dividends1099: {
      table: 'Dividends on a 1099-DIV',
      citation:
        'A 1099-DIV shows no tax rate. The general rate, 30%, is used (Publication 519 (2025), page 30), assuming no tax treaty lowers it (TODO confirm with CPA). Its box 4 withholding is credited on Form 1040-NR line 25b, “Form(s) 1099” (Instructions for Form 1040-NR (2025), page 22).',
    },
    capitalGains: {
      table: 'Trading: the 183-day rule',
      citation:
        'Publication 519 (2025), page 32: “If you were in the United States for 183 days or more during the tax year, your net gain from sales or exchanges of capital assets is taxed at a 30% (or lower treaty) rate”; net gain is U.S.-source gains minus U.S.-source losses, and “Capital losses in excess of capital gains” don’t count; “If you were in the United States for less than 183 days during the tax year, capital gains … are tax exempt” unless effectively connected. Instructions for Form 1040-NR (2025), page 44, Schedule NEC lines 16 to 18: “Include these gains and losses only if you were in the United States at least 183 days during 2025.” The days are the ones counted on the Time in the U.S. screens.',
    },
    gainSource: {
      table: 'Trading: where a gain comes from',
      citation:
        'Publication 519 (2025), page 20, Personal Property: a gain on personal property (stock is personal property) “generally has its source in the United States if you have a tax home in the United States. If you do not have a tax home in the United States, the gain or loss is generally considered to be from sources outside the United States.” Tax home (pages 8 and 20): “the general area of your main place of business, employment, or post of duty, regardless of where you maintain your family home”; with no regular place of business, “the place where you regularly live”. AtlasTax asks “was your main home in the U.S. or in your home country?” and uses the answer as the tax home (TODO confirm with CPA: the question says “main home”, the rule says tax home). The exceptions on pages 20 and 21 (inventory, depreciable property, intangibles, an office or fixed place of business) are not worked out.',
    },
    gainTax: {
      table: 'Trading: the tax on a U.S. gain',
      citation:
        'Publication 519 (2025), page 32: with 183 days or more in the U.S., “your net gain from sales or exchanges of capital assets is taxed at a 30% (or lower treaty) rate”; net gain is U.S.-source gains over U.S.-source losses, and the capital loss carryover and losses beyond gains aren’t used. Instructions for Form 1040-NR (2025): page 42, Schedule NEC, “Enter your income in the row that lists the correct category of income and in the column that lists the correct tax rate” (30% is column (c)); page 44, Schedule NEC “Line 9—Capital Gain: Enter the amount from Schedule NEC (Form 1040-NR), line 18”, and lines 16 to 18, “Include these gains and losses only if you were in the United States at least 183 days”. The tax joins the dividends and interest on Schedule NEC line 15 → Form 1040-NR line 23a. A tax treaty may exempt or lower it: not covered (TODO confirm with CPA).',
    },
    bankInterest: {
      table: 'U.S. bank interest',
      citation:
        'Publication 519 (2025), page 22: for a nonresident, “Interest income that is not connected with a U.S. trade or business is excluded from income if it is from: Deposits (including certificates of deposit) with persons in the banking business; … credit unions …”. Not entered on Form 1040-NR: Instructions for Form 1040-NR (2025), page 19, line 2a Exception 2 and line 2b Exception 3 (“Don’t include … interest from a U.S. bank … that is exempt from tax … under section 871(i) because the interest isn’t effectively connected”). Assumes the interest is from a U.S. bank account and not connected with a U.S. business.',
    },
    scholarshipRule: {
      table: 'Scholarship: the taxable part',
      citation:
        'Publication 519 (2025), pages 24 and 25: a scholarship is excludable only if you are a candidate for a degree at an eligible educational institution and use it for qualified education expenses (tuition and fees required to enroll, and course-related fees, books, supplies and equipment required of all students). Room and board, travel and research do not qualify, so amounts used for them are taxable. Instructions for Form 1040-NR (2025), page 31, Line 8r: “if you were a degree candidate … include on line 8r only the amounts you used for expenses other than tuition, fees, and required, course-related expenses”.',
    },
    scholarshipBox2: {
      table: 'Scholarship: Form 1042-S box 2',
      citation:
        'Instructions for Form 1042-S (2025), page 25, Box 2 (gross income). Instructions for Form 1040-NR (2025), page 31, Line 8r Example 1: box 2 often shows only the taxable part, “because withholding agents … aren’t required to report section 117 qualified expenses (required tuition, fees, books, supplies, and equipment) on Form 1042-S”. So the taxable part is never more than box 2.',
    },
    scholarshipEci: {
      table: 'Scholarship: taxed at the normal rates',
      citation:
        'Publication 519 (2025), page 26: for an F, J, M or Q student, “The taxable part of any scholarship or fellowship grant that is U.S. source income is treated as effectively connected with a trade or business in the United States.” It goes on Schedule 1 (Form 1040), line 8r, and from there to Form 1040-NR, line 8 (Instructions for Form 1040-NR (2025), page 31).',
    },
    scholarshipCodes: {
      table: 'Scholarship: Form 1042-S codes',
      citation:
        'Instructions for Form 1042-S (2025): box 1 income code 16 is “Scholarship or fellowship grants” (Appendix A, page 36); box 3a holds “00” when tax was withheld, or an exemption code from 01 to 24 when the rate is 00.00 (page 26; codes on page 37, e.g. 04 “Exempt under tax treaty”). Only code 16 with “00” (or blank) is worked out.',
    },
    scholarshipWithheld: {
      table: 'Scholarship: tax withheld',
      citation:
        'Instructions for Form 1040-NR (2025), page 22, Line 25g: “Enter on line 25g the total amount shown as federal income tax withheld … on your Form(s) 1042-S. The withholding credit should be shown in box 10”. Instructions for Form 1042-S (2025), page 29: box 10 is boxes 7a + 8 + 9.',
    },
    services: {
      table: 'Scholarship: pay for services',
      citation:
        'Publication 519 (2025), page 25, “Payment for services”: the part of a scholarship that pays for teaching, research or other services can’t be excluded. Income code 16 is a grant, not pay for services (codes 19 and 20 are compensation: Instructions for Form 1042-S (2025), page 36), so none is assumed.',
    },
  },
}
