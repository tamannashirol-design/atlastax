// FORM 1040-NR (2025) → which value goes in which field. Pure.
//
// Field names are the IRS's own in the 2025 PDF (fixtures/synthetic/irs-blank-forms/f1040nr--2025.pdf), tied to
// their lines by position on the page (the PDF has no tooltips); `npm run check:forms` re-reads the PDF and
// checks every name used here exists and is the right kind of field.
//
// The AMOUNTS come from the SAME `Estimate` the page shows (its federal lines), never recalculated here,
// so the form and the page can't disagree. Whole dollars, as the estimate has them.
//
//   Page 1                                          field
//   First name and middle initial / Last name       f1_14 / f1_15
//   Your identifying number (max 9)                 f1_16   (masked: "•••••6789", last 4 only)
//   Home address, apt., city, state, ZIP            f1_17, f1_18, f1_19, f1_20, f1_21   (W-2 box f, as confirmed on Review)
//   Foreign country, province, postal code          f1_22, f1_23, f1_24                 (only for a foreign address: empty)
//   Filing status: Single                           c1_5[0]
//   Digital assets: Yes / No                        c1_6[0] / c1_6[1]                   (from your answer; unanswered: listed)
//   Line 1a  W-2 box 1 (after any treaty exemption) f1_42
//   Line 1k  treaty-exempt income                   f1_53   (China)
//   Line 1z  add lines 1a to 1h                     f1_54
//   Line 8   additional income (Schedule 1 line 10)   f1_68   (the taxable scholarship, Schedule 1 line 8r)
//   Line 9   total effectively connected income     f1_69
//   Line 11a adjusted gross income                  f1_71
//   Page 2
//   Line 11b / 12 / 14 / 15                         f2_01 / f2_02 / f2_06 / f2_07   (line 12: the India treaty standard deduction)
//   Line 16 tax / 18 / 22 / 24 total tax            f2_09 / f2_11 / f2_15 / f2_20
//   Line 25a W-2 withheld / 25d / 25g 1042-S / 33   f2_21 / f2_24 / f2_27 / f2_35
//   U.S. bank interest: NOT entered (exempt: Instructions for Form 1040-NR (2025), page 19, line 2a Exception 2, line 2b Exception 3)
//   Line 34 overpaid (refund) / Line 37 amount owed f2_36 / f2_42
//   Third-party designee: Yes / No                  c2_7[0] / c2_7[1]   (always No: AtlasTax doesn't ask)
import { isCalculated, type Estimate, type EstimateLine } from '../tax/estimate.ts'
import type { ConfirmedDocument, TaxInput } from '../tax/input.ts'
import { confirmedValue, dollars, maskedId, parseUSAddress } from './data.ts'
import type { FormFill } from './types.ts'

const p1 = (tail: string) => `topmostSubform[0].Page1[0].${tail}`
const p2 = (tail: string) => `topmostSubform[0].Page2[0].${tail}`

export const F1040NR = {
  first: p1('f1_14[0]'),
  last: p1('f1_15[0]'),
  id: p1('f1_16[0]'),
  street: p1('f1_17[0]'),
  apt: p1('f1_18[0]'),
  city: p1('f1_19[0]'),
  state: p1('f1_20[0]'),
  zip: p1('f1_21[0]'),
  single: p1('c1_5[0]'),
  digitalYes: p1('c1_6[0]'),
  digitalNo: p1('c1_6[1]'),
  line1a: p1('f1_42[0]'),
  line1k: p1('Line1k_ReadOrder[0].f1_53[0]'), // inside the IRS's own group
  line1z: p1('f1_54[0]'),
  line8: p1('f1_68[0]'),
  line9: p1('f1_69[0]'),
  line11a: p1('f1_71[0]'),
  line11b: p2('f2_01[0]'),
  line12: p2('f2_02[0]'),
  line14: p2('f2_06[0]'),
  line15: p2('f2_07[0]'),
  line16: p2('f2_09[0]'),
  line18: p2('f2_11[0]'),
  line22: p2('f2_15[0]'),
  line24: p2('f2_20[0]'),
  line25a: p2('Line25_ReadOrder[0].f2_21[0]'), // inside the IRS's own group
  line25d: p2('f2_24[0]'),
  line25g: p2('f2_27[0]'),
  line33: p2('f2_35[0]'),
  line34: p2('f2_36[0]'),
  line37: p2('f2_42[0]'),
  designeeYes: p2('c2_7[0]'),
  designeeNo: p2('c2_7[1]'),
} as const

export type Build1040NR = { docs: readonly ConfirmedDocument[]; estimate: Estimate; person?: Pick<TaxInput['person'], 'marital' | 'digitalAssets'> }

export function build1040NR({ docs, estimate, person = { marital: null, digitalAssets: null } }: Build1040NR): FormFill {
  const fed = estimate.federal
  const lines = isCalculated(fed) ? fed.lines : []
  const get = (id: string): EstimateLine | undefined => lines.find((l) => l.id === id)
  const amount = (id: string): number | null => get(id)?.amount ?? null
  const values: FormFill['values'] = {}
  const blank: string[] = []
  const check: string[] = []
  const notIncluded: string[] = []
  const overlays: FormFill['overlays'] = []
  const put = (field: string, cents: number | null) => {
    if (cents !== null) values[field] = dollars(cents)
  }

  // ---- who you are
  // The two names exactly as confirmed on the passport (nothing is split or guessed)
  const first = confirmedValue(docs, 'Passport', 'firstName')
  const last = confirmedValue(docs, 'Passport', 'lastName')
  if (first) values[F1040NR.first] = first
  else blank.push('Your first name and middle initial (not on a passport you confirmed)')
  if (last) values[F1040NR.last] = last
  else blank.push('Your last name (not on a passport you confirmed)')
  const id = maskedId(docs, 'W-2', 'employeeTaxId', 'ssn', 9)
  if (id) {
    values[F1040NR.id] = id
    check.push('Your identifying number shows only its last 4 digits.')
  } else blank.push('Your identifying number (SSN or ITIN): not on a document you confirmed')

  // Home address: the W-2's box f, as confirmed on Review
  const address = confirmedValue(docs, 'W-2', 'employeeAddress')
  const parts = address ? parseUSAddress(address) : null
  if (parts) {
    values[F1040NR.street] = parts.street
    if (parts.apt) values[F1040NR.apt] = parts.apt
    values[F1040NR.city] = parts.city
    values[F1040NR.state] = parts.state
    values[F1040NR.zip] = parts.zip
    check.push('Your home address is the one on your W-2 (box f). If you’ve moved since, change it.')
  } else if (address) {
    values[F1040NR.street] = address.slice(0, 80)
    blank.push('Your city, state and ZIP code (we couldn’t read them from the address on your W-2, so it is all on the first line)')
  } else blank.push('Your home address (not on a W-2 you confirmed)')
  // Filing status: Single (married gives no estimate, so no 1040-NR: src/tax/stops.ts)
  values[F1040NR.single] = true
  if (person.marital !== 'single') check.push('Filing status is Single: you haven’t answered the marital status question.')
  // Digital assets: from the answer to "did you receive or sell crypto, NFTs or other digital assets?"
  if (person.digitalAssets === 'no') values[F1040NR.digitalNo] = true
  else if (person.digitalAssets === 'yes') values[F1040NR.digitalYes] = true
  else blank.push('The digital assets question, Yes or No (you haven’t answered it)')

  // ---- income, from the estimate's own lines
  const wages = amount('wages')
  const treaty = get('treaty') // China: the exempt wages
  put(F1040NR.line1a, wages)
  if (treaty) put(F1040NR.line1k, treaty.amount)
  put(F1040NR.line1z, wages)
  // Line 8: the taxable scholarship (Schedule 1 line 8r → line 10 → Form 1040-NR line 8; Instructions page 31)
  const scholarshipLine = get('scholarship')
  if (scholarshipLine) put(F1040NR.line8, scholarshipLine.amount)
  put(F1040NR.line9, amount('total-income'))
  put(F1040NR.line11a, amount('total-income'))
  put(F1040NR.line11b, amount('total-income'))

  // ---- deductions: line 12 only when the India treaty standard deduction applies
  const deduction = get('deduction')
  if (deduction?.treaty) {
    put(F1040NR.line12, deduction.amount)
    put(F1040NR.line14, deduction.amount)
    overlays.push({ page: 2, x: 37, y: 713, size: 5, maxWidth: 52, text: 'Standard Deduction Allowed Under U.S.-India Income Tax Treaty' })
  } else blank.push('Line 12: itemized deductions (not included in this estimate yet)')
  put(F1040NR.line15, amount('taxable'))

  // ---- tax and payments
  const tax = amount('tax')
  put(F1040NR.line16, tax)
  put(F1040NR.line18, tax)
  put(F1040NR.line22, tax)
  put(F1040NR.line24, tax)
  const withheld = amount('withheld')
  put(F1040NR.line25a, withheld)
  put(F1040NR.line25d, withheld)
  // Line 25g: 1042-S box 10 (Instructions page 22); line 33: all payments
  const withheld1042 = get('withheld-1042s')
  if (withheld1042) put(F1040NR.line25g, withheld1042.amount)
  put(F1040NR.line33, amount('total-payments') ?? withheld)
  const result = amount('result')
  if (isCalculated(fed) && result !== null) {
    if (fed.status === 'refund') {
      put(F1040NR.line34, result)
      blank.push('Lines 35a to 35e: how you want your refund paid, and your bank details (we don’t ask)')
    } else if (fed.status === 'owed') put(F1040NR.line37, result)
  }

  // ---- what a signed return would still need
  blank.push('Your signature, date, occupation, phone and email')
  // Third-party designee: No (AtlasTax doesn't ask: nobody else is named to talk to the IRS about this return)
  values[F1040NR.designeeNo] = true
  if (treaty || deduction?.treaty) check.push(`A student treaty benefit is included (${treaty ? 'line 1k' : 'line 12'}), based on the country you lived in before coming to the U.S.`)

  notIncluded.push(scholarshipLine ? 'Lines 2 to 7 (other interest, dividends, retirement income and capital gains) are not part of this estimate yet, so they are empty.' : 'Lines 2 to 8 (other interest, dividends, retirement income, capital gains and other income) are not part of this estimate yet, so they are empty.')
  if (get('bank-interest')) notIncluded.push('Your U.S. bank interest is not entered: for a nonresident it is exempt, and the instructions say not to include it on lines 2a or 2b (Instructions for Form 1040-NR (2025), page 19).')
  if (scholarshipLine) {
    notIncluded.push('Schedule 1 (Form 1040), with your taxable scholarship on line 8r (it goes to line 8 of this form), is not included yet.')
    notIncluded.push('Attach your Form 1042-S to the front of this form when you mail it.')
  }
  notIncluded.push('Schedule OI (Form 1040-NR) is required with every Form 1040-NR' + (treaty ? ', and its item L explains the treaty-exempt income on line 1k, plus a statement of why you qualify (Instructions for Form 1040-NR, page 18)' : '') + '. It is not included yet.')
  // Instructions for Form 1040-NR (2025), page 23, Assemble Your Return: "Attach a copy of Forms W-2 … to the front of
  // Form 1040-NR"; Form W-2 (2025): "Copy B—To Be Filed With Employee’s FEDERAL Tax Return"
  notIncluded.push('Attach Copy B of your W-2 to the front of this form when you mail it.')

  return { id: 'form-1040nr', status: 'ready', values, overlays, blank, check, notIncluded }
}
