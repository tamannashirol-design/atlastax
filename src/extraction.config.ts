// EXTRACTION FIELDS: which details are read from each kind of document.
//
// Box numbers checked against the IRS Form W-2 and Form 1042-S PDFs (irs.gov/pub/irs-pdf/fw2.pdf, f1042s.pdf;
// the versions online in Nov 2026 are the 2026 forms; the 2025 layout is believed identical, not checked).
//
// TODO confirm with CPA: every field below is a PLACEHOLDER (which fields,
// their names, which can be "Not on my form"). Open questions:
//   - 1099-DIV and 1099-B fields (left as a short placeholder list)
//   - Optional documents (driver's license or state ID, previous return) are read
//     when added (designer decision) and never block: their field lists below are
//     placeholders. No license number is read (not needed, and sensitive).
//   - Which W-2 Box 12 / 14 entries matter for a 1040-NR?
//
// This is the only place these rules live (see EXTRACTION-PLAN.md §3).
// Components never decide which fields exist, which are masked, or which
// need a tick; they read FIELDS / fieldsForItem().
//
// needsTick (designer decision, EXTRACTION-PLAN.md §5): every value that goes
// into a tax form or identifies the person needs its own "This is correct"
// tick, whatever the confidence: money, ID numbers, names, dates, and the
// codes and countries that go on the return. Other details need a tick only
// when flagged "Please check". `npm run check:extraction` enforces that
// every money / id / name / date field has needsTick.
import type { SensitiveId } from './lib/mask.ts'

export type FieldKind =
  | 'money' // tabular, dollars and cents
  | 'id' // an ID number (masked when `sensitive` is set)
  | 'name' // a person's or organisation's name
  | 'date'
  | 'code' // a code printed on the form (e.g. 1042-S income code)
  | 'country'
  | 'state' // two-letter U.S. state
  | 'address' // a postal address (shown on two lines on Review, so all of it can be checked)
  | 'text'

export type FieldSpec = {
  /** Stable key, e.g. 'wages' */
  key: string
  /** Plain words shown above the field */
  label: string
  /** Where it is on the paper form, e.g. "Box 1" */
  box?: string
  kind: FieldKind
  /** Masked everywhere (src/lib/mask.ts). Only SSN, ITIN, EIN, passport number. */
  sensitive?: SensitiveId
  /** Always needs its own tick, whatever the confidence (see top of file) */
  needsTick: boolean
  /** The person may answer "Not on my form" instead of typing a value */
  mayBeBlank?: boolean
}

export type FormType = 'W-2' | '1042-S' | '1099-INT' | '1099-NEC' | '1099-DIV' | '1099-B' | 'Passport' | 'I-94' | 'State ID' | 'Previous return'

const money = (key: string, label: string, box?: string, mayBeBlank = false): FieldSpec => ({ key, label, box, kind: 'money', needsTick: true, mayBeBlank })

export const FIELDS: Record<FormType, FieldSpec[]> = {
  'W-2': [
    // Same mask shape for SSN and ITIN; the Review screen uses answers.taxId
    // to say "ITIN" instead of "SSN" when that's what the person has.
    { key: 'employeeTaxId', label: 'Your SSN or ITIN', box: 'Box a', kind: 'id', sensitive: 'ssn', needsTick: true },
    // Box f, "Employee's address and ZIP code" (Form W-2 (2025)): goes on the 1040-NR as your home address, so it needs a tick
    { key: 'employeeAddress', label: 'Your address', box: 'Box f', kind: 'address', needsTick: true, mayBeBlank: true },
    { key: 'employerName', label: 'Employer', box: 'Box c', kind: 'name', needsTick: false },
    { key: 'employerEin', label: 'Employer EIN', box: 'Box b', kind: 'id', sensitive: 'ein', needsTick: true },
    money('wages', 'Wages', 'Box 1'),
    money('federalWithheld', 'Federal tax withheld', 'Box 2'),
    // The state decides which state return applies, so it needs a tick like the amounts do
    { key: 'state', label: 'State', box: 'Box 15', kind: 'state', needsTick: true, mayBeBlank: true },
    money('stateWages', 'State wages', 'Box 16', true),
    money('stateWithheld', 'State tax withheld', 'Box 17', true),
  ],
  '1042-S': [
    { key: 'withholdingAgent', label: 'Withholding agent', box: 'Box 12d', kind: 'name', needsTick: false },
    { key: 'incomeCode', label: 'Income code', box: 'Box 1', kind: 'code', needsTick: true },
    money('grossIncome', 'Gross income', 'Box 2'),
    { key: 'exemptionCode', label: 'Exemption code', box: 'Box 3a', kind: 'code', needsTick: true, mayBeBlank: true },
    { key: 'taxRate', label: 'Tax rate', box: 'Box 3b', kind: 'code', needsTick: true, mayBeBlank: true },
    // Box 10 (total withholding credit = boxes 7a + 8 + 9) is what the 1040-NR credits on line 25g, not Box 7a
    money('federalWithheld', 'Total tax withheld (credit)', 'Box 10', true),
    { key: 'recipientCountry', label: 'Your country code', box: 'Box 13b', kind: 'country', needsTick: true },
  ],
  '1099-INT': [
    { key: 'payerName', label: 'Bank', kind: 'name', needsTick: false },
    money('interest', 'Interest income', 'Box 1'),
    money('federalWithheld', 'Federal tax withheld', 'Box 4', true),
  ],
  '1099-NEC': [
    { key: 'payerName', label: 'Client', kind: 'name', needsTick: false },
    { key: 'payerTin', label: 'Client’s EIN', kind: 'id', sensitive: 'ein', needsTick: true, mayBeBlank: true },
    money('compensation', 'Amount paid to you', 'Box 1'),
    money('federalWithheld', 'Federal tax withheld', 'Box 4', true),
  ],
  // TODO confirm with CPA: placeholder lists
  '1099-DIV': [
    { key: 'payerName', label: 'Brokerage or bank', kind: 'name', needsTick: false },
    money('ordinaryDividends', 'Total ordinary dividends', 'Box 1a'),
    money('federalWithheld', 'Federal tax withheld', 'Box 4', true),
  ],
  '1099-B': [
    { key: 'payerName', label: 'Brokerage', kind: 'name', needsTick: false },
    money('proceeds', 'Total proceeds', 'Box 1d'),
    money('costBasis', 'Total cost basis', 'Box 1e', true),
    money('federalWithheld', 'Federal tax withheld', 'Box 4', true),
  ],
  Passport: [
    // Two names, as the passport prints them (the forms ask for first and last name: nothing is split or guessed)
    { key: 'firstName', label: 'First name', box: 'Given names', kind: 'name', needsTick: true },
    { key: 'lastName', label: 'Last name', box: 'Surname', kind: 'name', needsTick: true },
    { key: 'passportNumber', label: 'Passport number', kind: 'id', sensitive: 'passport', needsTick: true },
    { key: 'country', label: 'Country that issued it', kind: 'country', needsTick: true },
    { key: 'dateOfBirth', label: 'Date of birth', kind: 'date', needsTick: true },
    { key: 'expires', label: 'Expiration date', kind: 'date', needsTick: true },
  ],
  'I-94': [
    { key: 'admissionNumber', label: 'Admission number', kind: 'id', needsTick: true },
    { key: 'classOfAdmission', label: 'Class of admission', kind: 'code', needsTick: true },
    { key: 'mostRecentEntry', label: 'Most recent entry date', kind: 'date', needsTick: true },
  ],
  // Optional documents (TODO confirm with CPA: whether and what to read)
  'State ID': [
    { key: 'fullName', label: 'Full name', kind: 'name', needsTick: true },
    { key: 'state', label: 'State that issued it', kind: 'state', needsTick: false },
    { key: 'expires', label: 'Expiration date', kind: 'date', needsTick: true },
  ],
  'Previous return': [
    { key: 'taxYear', label: 'Tax year', kind: 'code', needsTick: true },
    money('totalIncome', 'Total income'),
    money('totalTax', 'Total tax'),
  ],
}

/**
 * Which form types a document item (from documents.config.ts) can be. Most
 * have one; "or" documents (investments, trading) can be either, and the
 * provider says which it found. Items not listed here aren't read (optional
 * documents, for now).
 */
export const ITEM_FORMS: Record<string, FormType[]> = {
  'bank-interest': ['1099-INT'],
  'opt-cpt': ['W-2'],
  'on-campus-job': ['W-2'],
  scholarship: ['1042-S'],
  freelance: ['1099-NEC'],
  investments: ['1042-S', '1099-DIV'],
  trading: ['1099-B', '1042-S'],
  'contract-work': ['1099-NEC'],
  passport: ['Passport'],
  i94: ['I-94'],
  // Optional: read when added, never block
  'state-id': ['State ID'],
  'previous-return': ['Previous return'],
}

/** The fields to read for an item, for the form type the provider found (or the first one). */
export function fieldsForItem(itemId: string, found?: FormType): FieldSpec[] {
  const forms = ITEM_FORMS[itemId] ?? []
  const form = found && forms.includes(found) ? found : forms[0]
  return form ? FIELDS[form] : []
}
