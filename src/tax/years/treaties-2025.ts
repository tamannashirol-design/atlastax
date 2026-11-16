// TAX YEAR 2025, TREATIES: the two student treaty benefits the federal estimate applies, each figure and
// condition with its IRS source. The ONLY place these numbers live (CLAUDE.md: tax rules never sit in
// components). Read from the IRS publications themselves (not from memory), marked TODO confirm with CPA.
//
// Sources (printed page numbers = the PDF's own pages):
//   P901  = Publication 901, U.S. Tax Treaties (Rev. September 2024), irs.gov/pub/irs-pdf/p901.pdf
//   P519  = Publication 519, U.S. Tax Guide for Aliens (2025), irs.gov/pub/irs-prior/p519--2025.pdf
//   I1040NR = Instructions for Form 1040-NR (2025), irs.gov/pub/irs-prior/i1040nr--2025.pdf
//
// WHAT WE KNOW AND WHAT WE ASSUME. We know the person's citizenship (the answer they gave) and their
// student visa (the questions only continue for students). A treaty depends on where the person was a
// RESIDENT just before coming to the U.S., which the app doesn't ask. The estimate assumes it matches
// the citizenship, says so in the breakdown, and applies the benefit only to the federal estimate.
// The time limits ("reasonable", "reasonably necessary") are not numbers in these publications, so they
// are NOT enforced here (TODO confirm with CPA); v1 only prepares a return within the first 5 years as a
// student anyway (src/residency.config.ts).
//
// Money is whole DOLLARS.
import type { Source } from '../estimate.ts'

export const TODO_CPA = 'TODO confirm with CPA'

export type IndiaTreaty = {
  /** Two-letter region code, as the citizenship question stores it */
  code: 'IN'
  country: 'India'
  article: 'Article 21(2)'
  kind: 'standard-deduction'
  /** Standard deduction, single (Worksheet 5-1, line 1). Not for someone who can be claimed as a dependent. */
  standardDeductionSingle: number
  /** What we assume and can't check (shown to the person) */
  assumptions: readonly string[]
  sources: Record<string, Source>
}

export type ChinaTreaty = {
  code: 'CN'
  country: 'China'
  article: 'Article 20'
  kind: 'wage-exemption'
  /** Personal services income exempt for each tax year */
  exemptWagesPerYear: number
  assumptions: readonly string[]
  sources: Record<string, Source>
}

export type Treaty = IndiaTreaty | ChinaTreaty

export const INDIA: IndiaTreaty = {
  code: 'IN',
  country: 'India',
  article: 'Article 21(2)',
  kind: 'standard-deduction',
  standardDeductionSingle: 15_750,
  assumptions: ['You were a resident of India just before you came to the U.S.', 'You’re here mainly to study', 'You don’t claim itemized deductions', 'No one else can claim you as a dependent'],
  sources: {
    rule: { table: 'India student treaty benefit', citation: 'Publication 519 (2025), page 39, Nonresident Aliens, “Standard deduction”: nonresident aliens cannot claim the standard deduction, but “students and business apprentices who are eligible for the benefits of Article 21(2) of the United States-India Income Tax Treaty … can claim the standard deduction, provided you do not claim itemized deductions.”' },
    amount: { table: 'India standard deduction', citation: 'Publication 519 (2025), page 40, Worksheet 5-1 (2025 Standard Deduction Worksheet for Students and Business Apprentices From India), line 1: “Single or married filing separately—$15,750” (a dependent’s smaller amount does not apply: we assume no one can claim you). Entered on Form 1040-NR, line 12 (Instructions for Form 1040-NR (2025), pages 20 and 21).' },
    conditions: { table: 'India treaty conditions', citation: 'Publication 901 (Rev. 9-2024), pages 33 and 34, India: “An individual who is a resident of India immediately before visiting the United States and who is temporarily in the United States primarily for studying or training …” may be eligible to deduct “the standard deduction. The individual must file Form 1040-NR to claim these amounts.” And: “The individual is entitled to these benefits only for a period of time considered reasonable or customarily required to complete studying or training.” That time limit is not a number there, so it is not enforced (TODO confirm with CPA).' },
  },
}

export const CHINA: ChinaTreaty = {
  code: 'CN',
  country: 'China',
  article: 'Article 20',
  kind: 'wage-exemption',
  exemptWagesPerYear: 5_000,
  assumptions: ['You were a resident of China when you arrived in the U.S.', 'You’re here only to study', 'You’re not a U.S. citizen'],
  sources: {
    rule: { table: 'China student treaty benefit', citation: 'Publication 901 (Rev. 9-2024), page 30, China, People’s Republic of: “A student, business apprentice, or trainee who is a resident of the People’s Republic of China on the date of arrival in the United States and who is present in the United States solely to obtain training, education, or special technical experience is exempt from U.S. income tax on … income from personal services performed in the United States of up to $5,000 for each tax year. An individual is entitled to the exemption only for the time reasonably necessary to complete the education or training.” Article 20 of the treaty: Publication 519 (2025), page 67. The treaty does not apply to Hong Kong (Publication 901, page 2).' },
    amount: { table: 'China wage exemption', citation: 'Publication 519 (2025), page 80, Appendix A (students), China: compensation for personal services “qualifies for exemption from withholding of federal income tax … in an amount not in excess of $5,000 for any tax year.” Conditions listed there: a resident of China on the date of arrival, not a U.S. citizen, present in the United States solely for education or training, only for the time reasonably necessary.' },
    reporting: { table: 'How it is reported', citation: 'Instructions for Form 1040-NR (2025), page 18, Amounts Exempt Under a Treaty: wages exempt under a treaty “should not be reported on line 1a. Instead, include these amounts on line 1k” and complete item L of Schedule OI; if wages were all in W-2 box 1, “reduce your line 1a wages by the exempt amount” (Example 2). The time limit is not a number there: not enforced (TODO confirm with CPA).' },
  },
}

/** The notes the result page shows when a treaty benefit is included (replacing "Treaty benefits aren’t included yet.") */
export const TREATY_NOTES = {
  IN: 'Includes the India student treaty standard deduction. It assumes you were a resident of India just before you came to the U.S.',
  CN: 'Includes the China student treaty wage exemption. It assumes you were a resident of China when you arrived and are here only to study.',
} as const

export const TREATIES_2025: Record<string, Treaty> = { IN: INDIA, CN: CHINA }
