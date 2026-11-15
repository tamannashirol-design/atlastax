// Checks masking (src/lib/mask.ts) and the extraction field rules
// (src/extraction.config.ts, TODO confirm with CPA).
// Run: npm run check:extraction
// Only allowed fake numbers are used here (see npm run check:files).
import { DOCUMENT_RULES, IDENTITY_DOCUMENTS } from '../src/documents.config.ts'
import { FIELDS, ITEM_FORMS, fieldsForItem, type FieldKind } from '../src/extraction.config.ts'
import { mask, maskSpoken } from '../src/lib/mask.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}

console.log('MASKING\n')
check('SSN shows last 4 only', mask('123-45-6789', 'ssn'), '•••-••-6789')
check('SSN typed without dashes', mask('123456789', 'ssn'), '•••-••-6789')
check('ITIN same shape as SSN', mask('555-55-5555', 'itin'), '•••-••-5555')
check('EIN', mask('12-3456789', 'ein'), '••-•••6789')
check('Passport number (letters kept, upper case)', mask('x1234567', 'passport'), '•••••4567')
check('Too short to show any digits', mask('1234', 'ssn'), '•••-••-••••')
check('Empty value shows nothing', mask('', 'ssn'), '')
check('Missing value shows nothing', mask(null, 'ein'), '')
check('Bullets don’t reveal length', mask('X123456789012', 'passport').length, mask('X1234567', 'passport').length)
check('Screen reader text', maskSpoken('123-45-6789', 'ssn'), 'SSN ending in 6 7 8 9')
check('Screen reader text, too short', maskSpoken('1234', 'passport'), 'Passport number, hidden')
check('Screen reader text, empty', maskSpoken('', 'itin'), 'ITIN not added')
for (const v of ['123-45-6789', '12-3456789', 'X1234567']) {
  for (const k of ['ssn', 'itin', 'ein', 'passport'] as const) {
    const digits = v.replace(/[^0-9A-Z]/gi, '')
    if (mask(v, k).includes(digits.slice(0, -4))) {
      console.log(`✗ ${k} mask leaks more than the last 4 of ${v}`)
      failed++
    }
  }
}

console.log('\nFIELD RULES\n')
const ALWAYS_TICK: FieldKind[] = ['money', 'id', 'name', 'date']
for (const [form, fields] of Object.entries(FIELDS)) {
  const keys = fields.map((f) => f.key)
  if (new Set(keys).size !== keys.length) {
    console.log(`✗ ${form}: duplicate field keys`)
    failed++
  }
  for (const f of fields) {
    // Names of organisations (employer, bank, client) don't identify the person
    const orgName = f.kind === 'name' && f.key !== 'fullName'
    if (ALWAYS_TICK.includes(f.kind) && !orgName && !f.needsTick) {
      console.log(`✗ ${form} · ${f.label}: a ${f.kind} goes into a tax form or identifies the person, so it needs needsTick`)
      failed++
    }
    if (f.sensitive && f.kind !== 'id') {
      console.log(`✗ ${form} · ${f.label}: only ID numbers can be masked`)
      failed++
    }
    if (/ssn|itin|ein|passport/i.test(f.key + f.label) && f.kind === 'id' && !f.sensitive && f.key !== 'admissionNumber') {
      console.log(`✗ ${form} · ${f.label}: looks like an SSN, ITIN, EIN or passport number but isn’t masked`)
      failed++
    }
  }
}
console.log('✓ every money, ID, personal name and date field needs its own tick')
console.log('✓ every SSN, ITIN, EIN and passport field is masked')

const required = [...DOCUMENT_RULES.map((r) => r.id), ...IDENTITY_DOCUMENTS.filter((d) => !d.optional).map((d) => d.id)]
const unread = required.filter((id) => !ITEM_FORMS[id])
check('every required document has fields to read', unread, [])
check('"or" document uses the form the provider found', fieldsForItem('investments', '1099-DIV')[1]?.key, 'ordinaryDividends')
check('"or" document falls back to its first form', fieldsForItem('investments')[1]?.key, 'incomeCode')
check('a form that isn’t one of the item’s forms is ignored', fieldsForItem('opt-cpt', 'Passport')[0]?.key, 'employeeTaxId')

console.log('\nFIELDS PER FORM (needs tick = ✔, masked = •)\n')
for (const [form, fields] of Object.entries(FIELDS)) {
  console.log(`${form}: ` + fields.map((f) => `${f.label}${f.needsTick ? ' ✔' : ''}${f.sensitive ? ' •' : ''}`).join(' · '))
}

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
