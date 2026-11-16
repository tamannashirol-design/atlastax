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
//   Home address, apt., city, state, ZIP            f1_17, f1_18, f1_19, f1_20, f1_21   (we don't ask: listed)
//   Foreign country, province, postal code          f1_22, f1_23, f1_24                 (we don't ask: listed)
//   Filing status: Single                           c1_5[0]
//   Digital assets: Yes / No                        c1_6[0] / c1_6[1]                   (we don't ask: listed)
//   Line 1a  W-2 box 1 (after any treaty exemption) f1_42
//   Line 1k  treaty-exempt income                   f1_53   (China)
//   Line 1z  add lines 1a to 1h                     f1_54
//   Line 9   total effectively connected income     f1_69
//   Line 11a adjusted gross income                  f1_71
//   Page 2
//   Line 11b / 12 / 14 / 15                         f2_01 / f2_02 / f2_06 / f2_07   (line 12: the India treaty standard deduction)
//   Line 16 tax / 18 / 22 / 24 total tax            f2_09 / f2_11 / f2_15 / f2_20
//   Line 25a W-2 withheld / 25d / 33 total payments f2_21 / f2_24 / f2_35
//   Line 34 overpaid (refund) / Line 37 amount owed f2_36 / f2_42
import { isCalculated, type Estimate, type EstimateLine } from '../tax/estimate.ts'
import type { ConfirmedDocument } from '../tax/input.ts'
import { confirmedValue, dollars, maskedId, splitName } from './data.ts'
import type { FormFill } from './types.ts'

const p1 = (tail: string) => `topmostSubform[0].Page1[0].${tail}`
const p2 = (tail: string) => `topmostSubform[0].Page2[0].${tail}`

export const F1040NR = {
  first: p1('f1_14[0]'),
  last: p1('f1_15[0]'),
  id: p1('f1_16[0]'),
  single: p1('c1_5[0]'),
  line1a: p1('f1_42[0]'),
  line1k: p1('Line1k_ReadOrder[0].f1_53[0]'), // inside the IRS's own group
  line1z: p1('f1_54[0]'),
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
  line33: p2('f2_35[0]'),
  line34: p2('f2_36[0]'),
  line37: p2('f2_42[0]'),
} as const

export type Build1040NR = { docs: readonly ConfirmedDocument[]; estimate: Estimate }

export function build1040NR({ docs, estimate }: Build1040NR): FormFill {
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
  const fullName = confirmedValue(docs, 'Passport', 'fullName')
  const name = fullName ? splitName(fullName) : null
  if (name?.first) values[F1040NR.first] = name.first
  if (name?.last) values[F1040NR.last] = name.last
  if (!name?.first || !name?.last) blank.push(name ? 'Your first name and middle initial (your passport shows a single name)' : 'Your name: first name and middle initial, last name (not on a passport you confirmed)')
  else check.push('Your name was split from your passport’s full name: the last word is the last name. Check which part is which.')
  const id = maskedId(docs, 'W-2', 'employeeTaxId', 'ssn', 9)
  if (id) {
    values[F1040NR.id] = id
    check.push('Your identifying number shows only its last 4 digits.')
  } else blank.push('Your identifying number (SSN or ITIN): not on a document you confirmed')

  blank.push('Your home address, and your foreign address if you have one (we don’t ask for it yet)')
  values[F1040NR.single] = true
  check.push('Filing status is Single: we don’t ask about marital status yet.')
  blank.push('The digital assets question, Yes or No (we don’t ask)')

  // ---- income, from the estimate's own lines
  const wages = amount('wages')
  const treaty = get('treaty') // China: the exempt wages
  put(F1040NR.line1a, wages)
  if (treaty) put(F1040NR.line1k, treaty.amount)
  put(F1040NR.line1z, wages)
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
  put(F1040NR.line33, withheld)
  const result = amount('result')
  if (isCalculated(fed) && result !== null) {
    if (fed.status === 'refund') {
      put(F1040NR.line34, result)
      blank.push('Lines 35a to 35e: how you want your refund paid, and your bank details (we don’t ask)')
    } else if (fed.status === 'owed') put(F1040NR.line37, result)
  }

  // ---- what a signed return would still need
  blank.push('Your signature, date, occupation, phone and email')
  blank.push('The third-party designee question, Yes or No')
  if (treaty || deduction?.treaty) check.push(estimate.notes.find((n) => /^Includes the/.test(n)) ?? 'A student treaty benefit is included.')

  notIncluded.push('Lines 2 to 8 (interest, dividends, retirement income, capital gains and other income) are not part of this estimate yet, so they are empty.')
  notIncluded.push('Schedule OI (Form 1040-NR) is required with every Form 1040-NR' + (treaty ? ', and its item L explains the treaty-exempt income on line 1k, plus a statement of why you qualify (Instructions for Form 1040-NR, page 18)' : '') + '. It is not included yet.')
  notIncluded.push('Your Form W-2 copies, which are attached to a real return.')

  return { id: 'form-1040nr', status: 'ready', values, overlays, blank, check, notIncluded }
}
