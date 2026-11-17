// TAX YEAR 2025, AFTER THE DOWNLOAD: what to do with the forms (the "What to do next" sheet on /result). Due dates,
// mailing addresses and payment details, each with the page of the IRS document they were copied from. Read from the
// documents themselves (not from memory). The ONLY place these live (CLAUDE.md: rules and addresses in year config).
//
// Sources (page numbers are the PDF's own, which match the printed ones):
//   I1040NR = Instructions for Form 1040-NR (2025), irs.gov/pub/irs-prior/i1040nr--2025.pdf
//   FW2     = Form W-2 (2025), irs.gov/pub/irs-prior/fw2--2025.pdf
//
// Anything the documents don't settle is a TODO confirm with CPA below, and the sheet doesn't state it.

export const TODO_CPA = 'TODO confirm with CPA'

export type Address = { lines: readonly string[] }

export type FilingConfig = {
  /** Due date of the return. Which one applies is decided by `dueBasis` on the estimate (a W-2 → "wages"). */
  /** `cite` is the short citation shown on screen; `source` is the full quote, for the CPA */
  due: { wages: { date: string }; noWages: { date: string }; source: string; cite: string }
  /** Where to mail Form 1040-NR (individuals), exactly as printed */
  mail: { withoutPayment: Address; withPayment: Address; updatesNote: string; postOfficeBoxNote: string; source: string; cite: string }
  pay: {
    /** The IRS's own payment page */
    url: string
    /** For people without a U.S. bank account */
    foreignUrl: string
    /** Paying by check or money order */
    check: string
    source: string
    cite: string
  }
  attach: { copyB: string; others: string; source: string; cite: string }
  refund: { source: string; cite: string }
  /** What the documents leave open (shown nowhere; for the CPA) */
  todo: readonly string[]
}

export const FILING_2025: FilingConfig = {
  due: {
    wages: { date: 'April 15, 2026' },
    noWages: { date: 'June 15, 2026' },
    source: 'Instructions for Form 1040-NR (2025), page 12, “When and Where Should You File?”: with wages “subject to U.S. income tax withholding”, a 2025 return “is due by April 15, 2026”; without them, “by June 15, 2026”.',
    cite: 'Instructions for Form 1040-NR (2025), page 12',
  },
  mail: {
    withoutPayment: { lines: ['Department of the Treasury', 'Internal Revenue Service', 'Austin, TX 73301-0215', 'USA'] },
    withPayment: { lines: ['Internal Revenue Service', 'P.O. Box 1303', 'Charlotte, NC 28201-1303', 'USA'] },
    updatesNote: 'These addresses are for returns filed in 2026. Check IRS.gov/Form1040NR for updates.',
    postOfficeBoxNote: 'Only the U.S. Postal Service can deliver to a P.O. box.',
    source: 'Instructions for Form 1040-NR (2025), pages 12 and 13, “Where To File”, Individuals. “Use these addresses for Forms 1040-NR filed in 2026. The address for returns filed after 2026 may be different.” Page 13: “Only the U.S. Postal Service can deliver to P.O. boxes.”',
    cite: 'Instructions for Form 1040-NR (2025), pages 12 and 13',
  },
  pay: {
    url: 'https://www.irs.gov/payments',
    foreignUrl: 'https://www.irs.gov/individuals/international-taxpayers/foreign-electronic-payments',
    check: 'A check or money order has to be drawn on a U.S. bank. Write “2025 Form 1040-NR” and your name, address, daytime phone number and SSN on it, and attach Form 1040-V.',
    source: 'Instructions for Form 1040-NR (2025): page 23, Line 37 (Exception 1: no U.S. bank account → IRS.gov/Individuals/International-Taxpayers/Foreign-Electronic-Payments; Exception 2: check or money order drawn on a U.S. financial institution, “2025 Form 1040-NR”, name, address, daytime phone number and SSN, attach Form 1040-V); page 27: “Go to IRS.gov/Payments for information on how to make a payment”; Form 1040-NR (2025), page 2, line 37: “www.irs.gov/Payments”.',
    cite: 'Instructions for Form 1040-NR (2025), pages 23 and 27',
  },
  attach: {
    copyB: 'Copy B is the copy for your federal tax return.',
    others: 'If you also got a Form 1042-S, attach a copy of that too.',
    source: 'Instructions for Form 1040-NR (2025), page 23, “Assemble Your Return”: “Attach a copy of Forms W-2, 1042-S … to the front of Form 1040-NR.” Form W-2 (2025): “Copy B—To Be Filed With Employee’s FEDERAL Tax Return.”',
    cite: 'Instructions for Form 1040-NR (2025), page 23',
  },
  refund: {
    source: 'Instructions for Form 1040-NR (2025), page 23, “Lines 35a Through 35e—Amount Refunded to You” (how the refund is paid is chosen on those lines, which the download leaves blank). The instructions give refund timing only for tax withheld on a 1042-S, so no timing is stated.',
    cite: 'Instructions for Form 1040-NR (2025), page 23',
  },
  todo: [
    `${TODO_CPA}: which due date applies. The instructions say April 15 for “an employee [who] received wages subject to U.S. income tax withholding”, June 15 otherwise. We use April 15 when there is a W-2 and June 15 when there isn't; a W-2 whose box 2 is zero is not settled by the instructions.`,
    `${TODO_CPA}: the sheet shows the due date as upcoming, as designed. The 2025 due dates (April 15 and June 15, 2026) are in the past as of Nov 2026; nothing about filing late is shown.`,
    `${TODO_CPA}: the instructions say to write the SSN on a check or money order; what someone with an ITIN writes isn't stated.`,
    `${TODO_CPA}: whether the payment is due on the same date for people whose return is due June 15 (the instructions' “pay by the due date” line, page 4, says April 15 “for most people”); not stated on the sheet.`,
    `${TODO_CPA}: Form 8843 is attached to the Form 1040-NR (Instructions for Form 8843 (2025), page 3: “If you are filing a 2025 Form 1040-NR, attach Form 8843 to it”); the sheet's steps, as designed, don't say so.`,
    `${TODO_CPA}: the downloaded forms are stamped “Prototype estimate, not for filing” on every page; the sheet, as designed, tells people to print and mail them.`,
  ],
}
