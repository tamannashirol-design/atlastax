// FORM 8843 (2025) → which confirmed value goes in which field. Pure.
//
// Field names are the IRS's own in the 2025 PDF (fixtures/synthetic/irs-blank-forms/f8843--2025.pdf), tied to
// their lines by position on the page (the PDF has no tooltips); `npm run check:forms` re-reads the PDF and
// checks every name used here exists and is the right kind of field (text with the right limit, or a box).
//
//   Page 1                                           field
//   Your first name and initial / Last name          f1_04 / f1_05   (the passport's first and last name, as confirmed)
//   Your U.S. taxpayer identification number (TIN)   f1_06   (max 11: the masked form "•••-••-6789" fits)
//   Address in country of residence / in the U.S.    f1_07 / f1_08   (only if filed by itself: left blank, listed)
//   Line 1a  visa type and date of most recent entry f1_09   (Instructions for Form 8843, page 3: "…the date of the most recent entry")
//   Line 1b  current nonimmigrant status             f1_10
//   Line 2   countries of citizenship                f1_11
//   Line 3a  countries that issued a passport        f1_12
//   Line 3b  passport number(s)                      f1_13   (masked: last 4 only)
//   Line 4a  days present in 2025 / 2024 / 2023      f1_14 / f1_15 / f1_16
//   Line 4b  days you can exclude (2025)             f1_17
//   Part II (teachers and trainees), lines 5 to 8    f1_18 to f1_25, c1_1: not for a student, left empty
//   Part III Line 9  school name, address, phone     f1_26   (we don't ask yet: listed)
//   Line 10  program director                        f1_27   (we don't ask yet: listed)
//   Line 11  visa type held 2019 to 2024             f1_28 to f1_33 (one letter each)
//   Line 12  exempt for more than 5 calendar years?  c1_2[0] Yes / c1_2[1] No
//   Line 13  applied for permanent residence?        c1_3[0] Yes / c1_3[1] No   (we don't ask: listed)
//   Line 14  explain line 13                         f1_34
//   Page 2   Parts IV (athletes) and V (medical): not for a student, left empty
import type { ConfirmedDocument } from '../tax/input.ts'
import { confirmedValue, countryName, maskedId, toMDY, visaLabel } from './data.ts'
import type { FormFacts, FormFill } from './types.ts'

const f = (name: string, i = 0) => `topmostSubform[0].Page1[0].${name}[${i}]`
export const F8843 = {
  first: f('f1_04'),
  last: f('f1_05'),
  tin: f('f1_06'),
  line1a: f('f1_09'),
  line1b: f('f1_10'),
  line2: f('f1_11'),
  line3a: f('f1_12'),
  line3b: f('f1_13'),
  days: [f('f1_14'), f('f1_15'), f('f1_16')], // tax year, year before, two years before
  line4b: f('f1_17'),
  line11: [f('f1_28'), f('f1_29'), f('f1_30'), f('f1_31'), f('f1_32'), f('f1_33')], // 2019 … 2024
  line12Yes: f('c1_2', 0),
  line12No: f('c1_2', 1),
} as const

export type Build8843 = { docs: readonly ConfirmedDocument[]; facts: FormFacts; year: number }

export function build8843({ docs, facts, year }: Build8843): FormFill {
  const values: FormFill['values'] = {}
  const blank: string[] = []
  const check: string[] = []

  // ---- who you are
  // The two names exactly as confirmed on the passport (nothing is split or guessed)
  const first = confirmedValue(docs, 'Passport', 'firstName')
  const last = confirmedValue(docs, 'Passport', 'lastName')
  if (first) values[F8843.first] = first
  else blank.push('Your first name and initial (not on a passport you confirmed)')
  if (last) values[F8843.last] = last
  else blank.push('Your last name (not on a passport you confirmed)')

  const tin = maskedId(docs, 'W-2', 'employeeTaxId', 'ssn', 11)
  if (tin) values[F8843.tin] = tin
  else blank.push('Your U.S. taxpayer identification number (SSN or ITIN), if you have one (not on a document you confirmed)')

  // ---- Part I
  const i94Class = visaLabel(confirmedValue(docs, 'I-94', 'classOfAdmission')) ?? facts.visa
  const entry = toMDY(confirmedValue(docs, 'I-94', 'mostRecentEntry'))
  if (i94Class && entry) values[F8843.line1a] = `${i94Class}, entered ${entry}`
  else {
    if (i94Class) values[F8843.line1a] = i94Class
    blank.push(i94Class ? 'Line 1a: the date of your most recent entry (from your I-94)' : 'Line 1a: your visa type and the date of your most recent entry (from your I-94)')
  }
  if (i94Class) values[F8843.line1b] = i94Class
  else blank.push('Line 1b: your current nonimmigrant status')
  if (i94Class) check.push('Line 1b is your visa type from your I-94. If your status changed since you last entered, add the date and the earlier status.')

  const citizen = countryName(facts.citizenship)
  if (citizen) values[F8843.line2] = citizen
  else blank.push('Line 2: your country of citizenship')

  const passportCountry = confirmedValue(docs, 'Passport', 'country')
  if (passportCountry) values[F8843.line3a] = passportCountry
  else blank.push('Line 3a: the country that issued your passport (not on a passport you confirmed)')
  const passportNumber = maskedId(docs, 'Passport', 'passportNumber', 'passport')
  if (passportNumber) values[F8843.line3b] = passportNumber
  else blank.push('Line 3b: your passport number (not on a passport you confirmed)')

  // ---- days: the tax year and the two before it, only the years that count as student years in the U.S.
  const dayYears = [year, year - 1, year - 2]
  let allDays = true
  dayYears.forEach((y, i) => {
    if (!facts.studentYears.includes(y)) return // not in the U.S. that year: nothing to enter
    const d = facts.daysComplete ? facts.days[String(y)] : undefined
    if (d !== undefined) values[F8843.days[i]] = String(d)
    else {
      allDays = false
      blank.push(`Line 4a, ${y}: the days you were in the U.S. (finish “Time in the U.S.” first)`)
    }
  })
  const taxYearDays = facts.daysComplete ? facts.days[String(year)] : undefined
  if (facts.inScope === true && taxYearDays !== undefined && allDays) {
    values[F8843.line4b] = String(taxYearDays)
    check.push(`Line 4b: all ${taxYearDays} days you were in the U.S. in ${year} are entered as days you can exclude, because you’re a student within your first 5 years (TODO confirm with CPA).`)
  } else blank.push(`Line 4b: the days in ${year} you can exclude (we couldn’t work it out yet)`)

  // ---- Part III (students)
  blank.push('Line 9: name, address and phone number of your school (we don’t ask for it yet)')
  blank.push('Line 10: name, address and phone number of your program director (we don’t ask for it yet)')
  const letter = facts.visa?.[0] ?? i94Class?.[0] ?? null
  const earlier = Array.from({ length: 6 }, (_, k) => year - 6 + k) // 2019 … 2024 for 2025
  let anyLetter = false
  earlier.forEach((y, k) => {
    if (letter && facts.studentYears.includes(y)) {
      values[F8843.line11[k]] = letter
      anyLetter = true
    }
  })
  if (anyLetter) check.push(`Line 11: your current visa type (${letter}) is entered for each earlier year you were here as a student. If it changed, attach a statement.`)
  if (facts.inScope === true) values[F8843.line12No] = true
  else if (facts.inScope === false) values[F8843.line12Yes] = true
  else blank.push('Line 12: whether you were exempt as a student for more than 5 calendar years')
  blank.push(`Line 13: whether you applied for permanent residence (a green card) in ${year}, Yes or No (we don’t ask)`)

  // ---- only if filed by itself
  blank.push('Your addresses (country of residence and U.S.): needed only if you file this form by itself')
  blank.push('Your signature and date: needed only if you file this form by itself')

  return {
    id: 'form-8843',
    status: 'ready',
    values,
    overlays: [],
    blank,
    check,
    notIncluded: [
      'Parts II, IV and V (teachers and trainees, professional athletes, a medical condition) are empty: they don’t apply to a student.',
      'The tax year dates at the top are empty: this is for the calendar year.',
    ],
  }
}
