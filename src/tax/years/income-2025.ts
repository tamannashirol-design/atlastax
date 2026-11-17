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
  sources: Record<string, Source>
}

export const INCOME_2025: IncomeConfig = {
  scholarshipIncomeCode: '16',
  notExemptCodes: ['00', null],
  sources: {
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
