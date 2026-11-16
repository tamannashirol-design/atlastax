// Checks the downloads on /result: Form 8843 and Form 1040-NR (src/forms/*, server/forms.ts, POST /api/forms/:id).
// Run: npm run check:forms
//
// What is proved:
//   1. the mapping: every IRS field name we fill exists in the official 2025 PDF, is the right kind of field,
//      and sits where the line it stands for is printed (positions read from the PDF itself)
//   2. the fill: the right value in the right field (the India and China treaty lines too), and the honest lists
//   3. privacy: only the last 4 digits of any ID number, in the fill AND in every byte of the generated PDF
//   4. the PDFs: "Prototype estimate, not for filing" on EVERY page, a last page listing what is blank
//   5. the server: made in memory, nothing saved, nothing logged, "Show estimate number" off withholds the 1040-NR
// Two kinds of case: OFFICIAL (read from the IRS's own PDF or instructions) and MINE (made-up values, worked out by hand).
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFArray, PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFTextField, decodePDFRawStream } from 'pdf-lib'
import { createApp } from '../server/app.ts'
import { FAKE } from '../server/extraction/fakeValues.ts'
import { renderForm } from '../server/forms.ts'
import { FIELDS, type FormType } from '../src/extraction.config.ts'
import { cleanFacts } from '../src/forms/clean.ts'
import { buildForms, formStatuses } from '../src/forms/index.ts'
import { F1040NR, build1040NR } from '../src/forms/map-1040nr.ts'
import { F8843, build8843 } from '../src/forms/map-8843.ts'
import { PROTOTYPE_MARK, TEMPLATES, TEMPLATE_DIR } from '../src/forms/templates.ts'
import { EMPTY_FACTS, type FormFacts, type FormFill } from '../src/forms/types.ts'
import { countryName, splitName, toMDY, visaLabel } from '../src/forms/data.ts'
import { mask, maskForBox } from '../src/lib/mask.ts'
import { estimateReturn, hideNumbers, type Estimate } from '../src/tax/estimate.ts'
import { buildTaxInput, type ConfirmedDocument, type TaxItem } from '../src/tax/input.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}
const read = (file: string) => readFileSync(new URL(`../${TEMPLATE_DIR}${file}`, import.meta.url))
const T = TEMPLATES[2025]

// ---------------------------------------------------------------------------------------------
console.log('OFFICIAL: the blank forms are the 2025 IRS originals\n')
check('both files are present and match the pinned fingerprints', await Promise.all(Object.values(T).map(async (t) => (await import('node:crypto')).createHash('sha256').update(read(t.file)).digest('hex') === t.sha256)), [true, true])
const dropXfa = (d: PDFDocument) => {
  d.catalog.lookup(PDFName.of('AcroForm'), PDFDict).delete(PDFName.of('XFA')) // as the server does: pdf-lib would print a warning otherwise
  return d
}
const blank8843 = dropXfa(await PDFDocument.load(read(T['form-8843'].file), { ignoreEncryption: true }))
const blank1040 = dropXfa(await PDFDocument.load(read(T['form-1040nr'].file), { ignoreEncryption: true }))
check('Form 8843 (2025): 4 pages (the form and its instructions), 48 fields', [blank8843.getPageCount(), blank8843.getForm().getFields().length], [4, 48])
check('Form 1040-NR (2025): 2 pages, 171 fields', [blank1040.getPageCount(), blank1040.getForm().getFields().length], [2, 171])
check('revisions recorded: 8843 Cat. No. 17227H, created 6/5/25; 1040-NR Cat. No. 11364D, created 9/8/25', [T['form-8843'].catNo, T['form-8843'].created, T['form-1040nr'].catNo, T['form-1040nr'].created], ['17227H', '6/5/25', '11364D', '9/8/25'])

console.log('\nOFFICIAL: every field we fill exists, is the right kind, and sits on its line (positions read from the PDF)\n')
// [name, page, x, y]: where the field is on the page. Each was matched by eye to the line printed there (the
// PDFs have no tooltips) and is kept here so a changed template is noticed. Bottom-left corner, PDF points.
type Spot = [name: string, page: number, x: number, y: number, what: string]
const spots8843: Spot[] = [
  [F8843.first, 1, 36, 672, 'first name and initial'],
  [F8843.last, 1, 246, 672, 'last name'],
  [F8843.tin, 1, 404, 672, 'U.S. taxpayer identification number'],
  [F8843.line1a, 1, 420, 588, 'line 1a'],
  [F8843.line1b, 1, 65, 564, 'line 1b'],
  [F8843.line2, 1, 342, 552, 'line 2'],
  [F8843.line3a, 1, 270, 540, 'line 3a'],
  [F8843.line3b, 1, 194, 528, 'line 3b'],
  [F8843.days[0], 1, 88, 504, 'line 4a, 2025'],
  [F8843.days[1], 1, 174, 504, 'line 4a, 2024'],
  [F8843.days[2], 1, 261, 504, 'line 4a, 2023'],
  [F8843.line4b, 1, 498, 492, 'line 4b'],
  [F8843.line11[0], 1, 347, 204, 'line 11, 2019'],
  [F8843.line11[1], 1, 441, 204, 'line 11, 2020'],
  [F8843.line11[2], 1, 88, 192, 'line 11, 2021'],
  [F8843.line11[3], 1, 174, 192, 'line 11, 2022'],
  [F8843.line11[4], 1, 261, 192, 'line 11, 2023'],
  [F8843.line11[5], 1, 347, 192, 'line 11, 2024'],
  [F8843.line12Yes, 1, 511, 170, 'line 12, Yes box'],
  [F8843.line12No, 1, 547, 170, 'line 12, No box'],
]
const p = (page: number, tail: string) => `topmostSubform[0].Page${page}[0].${tail}`
const spots1040: Spot[] = [
  [F1040NR.first, 1, 36, 666, 'first name and middle initial'],
  [F1040NR.last, 1, 246, 666, 'last name'],
  [F1040NR.id, 1, 469, 666, 'identifying number'],
  [F1040NR.single, 1, 103, 584, 'filing status: Single'],
  [F1040NR.line1a, 1, 504, 384, 'line 1a'],
  [F1040NR.line1k, 1, 410, 252, 'line 1k'],
  [F1040NR.line1z, 1, 504, 240, 'line 1z'],
  [F1040NR.line9, 1, 504, 96, 'line 9'],
  [F1040NR.line11a, 1, 504, 60, 'line 11a'],
  [F1040NR.line11b, 2, 504, 732, 'line 11b'],
  [F1040NR.line12, 2, 504, 714, 'line 12'],
  [F1040NR.line14, 2, 504, 666, 'line 14'],
  [F1040NR.line15, 2, 504, 654, 'line 15'],
  [F1040NR.line16, 2, 504, 642, 'line 16'],
  [F1040NR.line18, 2, 504, 618, 'line 18'],
  [F1040NR.line22, 2, 504, 570, 'line 22'],
  [F1040NR.line24, 2, 504, 498, 'line 24'],
  [F1040NR.line25a, 2, 410, 474, 'line 25a'],
  [F1040NR.line25d, 2, 504, 438, 'line 25d'],
  [F1040NR.line33, 2, 504, 300, 'line 33'],
  [F1040NR.line34, 2, 504, 288, 'line 34 (overpaid)'],
  [F1040NR.line37, 2, 504, 198, 'line 37 (amount you owe)'],
]
function where(doc: PDFDocument, name: string) {
  const field = doc.getForm().getField(name)
  const widget = field.acroField.getWidgets()[0]
  const r = widget.getRectangle()
  return { kind: field.constructor.name, page: doc.getPages().findIndex((pg) => pg.ref === widget.P()) + 1, x: Math.round(r.x), y: Math.round(r.y), max: field instanceof PDFTextField ? field.getMaxLength() : undefined }
}
for (const [label, doc, spots] of [['Form 8843', blank8843, spots8843], ['Form 1040-NR', blank1040, spots1040]] as const) {
  const wrong = spots.filter(([name, page, x, y]) => {
    try {
      const w = where(doc, name)
      const isBox = /\.c\d_\d\[\d\]$/.test(name)
      return w.page !== page || Math.abs(w.x - x) > 2 || Math.abs(w.y - y) > 2 || w.kind !== (isBox ? 'PDFCheckBox' : 'PDFTextField')
    } catch {
      return true
    }
  })
  check(`${label}: all ${spots.length} fields we fill exist, are the right kind, and are where their lines are printed`, wrong.map((s) => s[4]), [])
}
check('the limits we rely on: 8843 TIN holds 11 characters; 1040-NR identifying number holds 9; the 8843 visa-year boxes hold 1', [where(blank8843, F8843.tin).max, where(blank1040, F1040NR.id).max, where(blank8843, F8843.line11[0]).max], [11, 9, 1])

// ---------------------------------------------------------------------------------------------
// The made-up person: the mock reader's fake W-2, passport and I-94 (the same fake values the app shows in development)
const doc = (itemId: string, form: FormType, over: Record<string, Partial<ConfirmedDocument['fields'][string]>> = {}, status: ConfirmedDocument['status'] = 'confirmed'): ConfirmedDocument => ({
  itemId,
  form,
  status,
  fields: Object.fromEntries(FIELDS[form].map((s) => [s.key, { value: FAKE[form][s.key] ?? '', ticked: true, notOnForm: false, confidence: 'high' as const, ...(over[s.key] ?? {}) }])),
})
const docs = [doc('passport', 'Passport'), doc('i94', 'I-94'), doc('opt-cpt', 'W-2')]
const items: TaxItem[] = [
  { id: 'passport', kind: 'document', label: 'Passport', status: 'added' },
  { id: 'i94', kind: 'document', label: 'Most recent I-94', status: 'added' },
  { id: 'opt-cpt', kind: 'document', label: 'W-2', status: 'added' },
]
const FACTS: FormFacts = { visa: 'F-1', citizenship: 'IN', days: { '2025': 365, '2024': 366, '2023': 140 }, daysComplete: true, studentYears: [2023, 2024, 2025], inScope: true }
const makeEstimate = (citizenship: string | null, documents = docs, extra: Partial<Parameters<typeof buildTaxInput>[0]> = {}): Estimate =>
  estimateReturn(buildTaxInput({ year: 2025, person: { citizenship: citizenship ?? undefined, visa: 'F-1' }, income: ['opt-cpt'], items, documents, ...extra }))
const forms = (citizenship: string | null, over: { docs?: ConfirmedDocument[]; facts?: FormFacts; estimate?: Estimate } = {}) => {
  const d = over.docs ?? docs
  return buildForms({ year: 2025, docs: d, facts: over.facts ?? { ...FACTS, citizenship }, estimate: over.estimate ?? makeEstimate(citizenship, d) })
}
const v = (fill: FormFill, name: string) => fill.values[name]

console.log('\nMINE: Form 1040-NR, from the same estimate the page shows (the fake W-2: wages $38,450, withheld $3,186)\n')
const inNR = forms('IN')['form-1040nr']
// India: standard deduction 15,750 → taxable 22,700 → tax 2,489 → refund 3,186 − 2,489 = 697 (src/tax, check:treaty)
check('India: 1a $38,450, 12 and 14 = $15,750, 15 = $22,700, 16 = $2,489, 25a = $3,186, refund on line 34 = $697', [F1040NR.line1a, F1040NR.line12, F1040NR.line14, F1040NR.line15, F1040NR.line16, F1040NR.line25a, F1040NR.line33, F1040NR.line34].map((n) => v(inNR, n)), ['38,450', '15,750', '15,750', '22,700', '2,489', '3,186', '3,186', '697'])
check('India: line 1k and line 37 are empty; the treaty words go in the margin of line 12', [v(inNR, F1040NR.line1k), v(inNR, F1040NR.line37), inNR.overlays.map((o) => o.text)], [undefined, undefined, ['Standard Deduction Allowed Under U.S.-India Income Tax Treaty']])
const cnNR = forms('CN')['form-1040nr']
// China: 38,450 − 5,000 = 33,450 → tax 3,779 → owes 3,779 − 3,186 = 593
check('China: 1a $33,450 (after the exemption), 1k $5,000 (treaty-exempt), 9 = $33,450, 16 = $3,779, owes $593 on line 37', [F1040NR.line1a, F1040NR.line1k, F1040NR.line9, F1040NR.line16, F1040NR.line37].map((n) => v(cnNR, n)), ['33,450', '5,000', '33,450', '3,779', '593'])
check('China: no standard deduction (lines 12 and 14 empty), line 34 empty, no margin words', [v(cnNR, F1040NR.line12), v(cnNR, F1040NR.line14), v(cnNR, F1040NR.line34), cnNR.overlays.length], [undefined, undefined, undefined, 0])
const frNR = forms('FR')['form-1040nr']
check('another country: no treaty line, tax $4,379, owes $1,193', [v(frNR, F1040NR.line1k), v(frNR, F1040NR.line12), v(frNR, F1040NR.line16), v(frNR, F1040NR.line37)], [undefined, undefined, '4,379', '1,193'])
check('filing status Single is ticked, and the form says we assumed it', [v(inNR, F1040NR.single), inNR.check.some((c) => /Filing status is Single/.test(c))], [true, true])
check('amounts are the page’s own numbers: every filled amount is in the estimate’s lines', (() => { const lines = (makeEstimate('IN').federal as { lines: { amount: number }[] }).lines.map((l) => Math.round(l.amount / 100).toLocaleString('en-US')); return Object.entries(inNR.values).filter(([n, x]) => typeof x === 'string' && /f1_(42|54|69|71)|f2_(01|02|06|07|09|11|15|20|21|24|35|36)/.test(n)).every(([, x]) => lines.includes(x as string)) })(), true)

console.log('\nMINE: Form 8843 (arrived on the I-94: F-1, most recent entry 08/15/2025; days counted 365, 366, 140)\n')
const f8843 = forms('IN')['form-8843']
check('name from the passport; line 1a from the I-94 (visa and most recent entry date); 1b F-1; line 2 India; 3a the passport’s country', [F8843.first, F8843.last, F8843.line1a, F8843.line1b, F8843.line2, F8843.line3a].map((n) => v(f8843, n)), ['SAMPLE', 'PERSON', 'F-1, entered 08/15/2025', 'F-1', 'India', 'Sample Country'])
check('line 4a: 365 days in 2025, 366 in 2024, 140 in 2023; line 4b: 365 (a student within the first 5 years)', [...F8843.days, F8843.line4b].map((n) => v(f8843, n)), ['365', '366', '140', '365'])
check('line 11: the visa letter F for the earlier years you were here (2023, 2024), nothing for 2019 to 2022', F8843.line11.map((n) => v(f8843, n)), [undefined, undefined, undefined, undefined, 'F', 'F'])
check('line 12: exempt for more than 5 years? No (in scope); the Yes box is empty', [v(f8843, F8843.line12No), v(f8843, F8843.line12Yes)], [true, undefined])
check('what is left blank is listed: lines 9, 10 and 13, the addresses, the signature', ['Line 9', 'Line 10', 'Line 13', 'Your addresses', 'Your signature'].map((s) => f8843.blank.some((b) => b.startsWith(s))), [true, true, true, true, true])
check('Parts II, IV and V are said to be empty, and nothing is written in them', [f8843.notIncluded.some((n) => /Parts II, IV and V/.test(n)), Object.keys(f8843.values).every((n) => !/f1_(18|19|2[0-5])|c1_1\[|Page2/.test(n))], [true, true])

console.log('\nMINE: ID numbers: last 4 only, everywhere\n')
// The person's actual numbers: whole, and the digits from their middle. (Whole files are searched only for the
// whole numbers: the IRS's embedded font holds the glyph list "0123456789", which would match shorter runs.)
const WHOLE = ['123-45-6789', 'X1234567', '12345678901', '12-3456789']
const FORBIDDEN = [...WHOLE, '123456789', '12345', '2345678', '1234567', '3456789']
const everything = JSON.stringify([forms('IN'), forms('CN'), forms('FR'), formStatuses(forms('IN'), 2025)])
check('TIN on Form 8843: •••-••-6789; passport number: •••••4567; 1040-NR identifying number: •••••6789', [v(f8843, F8843.tin), v(f8843, F8843.line3b), v(inNR, F1040NR.id)], ['•••-••-6789', '•••••4567', '•••••6789'])
check('no full SSN, passport, EIN or admission number, and no middle digits of one, anywhere in what we fill or send to the page', FORBIDDEN.filter((s) => everything.includes(s)), [])
check('no SSN-shaped number at all (only the masked shape)', /\d{3}-\d{2}-\d{4}/.test(everything), false)
check('maskForBox keeps only the last 4: 9 boxes get 5 bullets + 4, a short number shows no digits', [maskForBox('123-45-6789', 'ssn', 9), maskForBox('123-45-6789', 'ssn', 11), maskForBox('1234', 'ssn', 9)], ['•••••6789', '•••-••-6789', '•••••••••'.slice(0, 5) + '••••'])
check('mask() is still the one place: SSN •••-••-6789, passport •••••4567', [mask('123-45-6789', 'ssn'), mask('X1234567', 'passport')], ['•••-••-6789', '•••••4567'])

console.log('\nMINE: only confirmed values are used; the rest is left blank and listed\n')
// An unticked value on a required document is a BLOCKER (src/tax/input.ts), so a real form is then not ready at all.
// These go straight to the data layer to prove it never uses a value that isn't properly confirmed.
const est = makeEstimate('IN')
const unDocs = [doc('passport', 'Passport', { fullName: { ticked: false }, passportNumber: { ticked: false } }), doc('i94', 'I-94'), doc('opt-cpt', 'W-2', { employeeTaxId: { ticked: false } })]
const un8843 = build8843({ docs: unDocs, facts: FACTS, year: 2025 })
const un1040 = build1040NR({ docs: unDocs, estimate: est })
check('an unticked name, passport number and SSN are never used (fields empty)', [v(un8843, F8843.first), v(un8843, F8843.tin), v(un8843, F8843.line3b), v(un1040, F1040NR.id)], [undefined, undefined, undefined, undefined])
check('…and said so in the blank lists', [un8843.blank.some((b) => /^Your name/.test(b)), un8843.blank.some((b) => /taxpayer identification number/.test(b)), un8843.blank.some((b) => /^Line 3b/.test(b)), un1040.blank.some((b) => /identifying number/.test(b))], [true, true, true, true])
check('and in the real flow that same unticked value holds the form back (a blocker), it is never half-filled', (() => { const e = makeEstimate('IN', unDocs); const f = buildForms({ year: 2025, docs: unDocs, facts: FACTS, estimate: e }); return [e.blockers.length > 0, f['form-8843'].status, f['form-1040nr'].status] })(), [true, 'not-ready', 'not-ready'])
const openDocs = [doc('passport', 'Passport', {}, 'open'), doc('i94', 'I-94', {}, 'skipped'), doc('opt-cpt', 'W-2')]
const open8843 = build8843({ docs: openDocs, facts: FACTS, year: 2025 })
check('a document still open or skipped is not used at all (no name, no entry date)', [v(open8843, F8843.first), v(open8843, F8843.line3a), open8843.blank.some((b) => /^Line 3a/.test(b))], [undefined, undefined, true])
check('with no I-94 the visa type comes from your answers, and the missing entry date is listed', [v(open8843, F8843.line1a), open8843.blank.some((b) => /^Line 1a: the date of your most recent entry/.test(b))], ['F-1', true])
const noDays = forms('IN', { facts: { ...FACTS, daysComplete: false, days: {}, inScope: null } })['form-8843']
check('days not finished: lines 4a, 4b and 12 are left blank and listed', [v(noDays, F8843.days[0]), v(noDays, F8843.line4b), v(noDays, F8843.line12No), noDays.blank.filter((b) => /^Line (4a|4b|12)/.test(b)).length], [undefined, undefined, undefined, 5])
check('a passport with one name: the first-name box is listed, not guessed', build8843({ docs: [doc('passport', 'Passport', { fullName: { value: 'MADONNA' } }), doc('i94', 'I-94'), doc('opt-cpt', 'W-2')], facts: FACTS, year: 2025 }).blank.some((b) => /first name and initial \(your passport shows a single name\)/.test(b)), true)
check('refund: the refund-payment lines are listed; owed: they are not', [inNR.blank.some((b) => /^Lines 35a to 35e/.test(b)), cnNR.blank.some((b) => /^Lines 35a to 35e/.test(b))], [true, false])
check('1040-NR without the India deduction lists line 12 (itemized deductions not included yet); with it, it does not', [frNR.blank.some((b) => /^Line 12/.test(b)), inNR.blank.some((b) => /^Line 12/.test(b))], [true, false])
check('1040-NR lists addresses, the digital assets question, signature and the designee question', ['Your home address', 'The digital assets', 'Your signature', 'The third-party'].map((s) => inNR.blank.some((b) => b.startsWith(s))), [true, true, true, true])
check('1040-NR says what it does not include: lines 2 to 8, Schedule OI (and, for China, item L and the statement), W-2 copies', [inNR.notIncluded.length, /item L/.test(cnNR.notIncluded.join(' ')), /item L/.test(inNR.notIncluded.join(' '))], [3, true, false])

console.log('\nMINE: when a form is not ready\n')
const blockedEstimate = estimateReturn(buildTaxInput({ year: 2025, person: { citizenship: 'IN', visa: 'F-1' }, income: [], items: [{ id: 'passport', kind: 'document', label: 'Passport', status: 'missing' }], documents: [] }))
const blocked = buildForms({ year: 2025, docs: [], estimate: blockedEstimate })
check('something unconfirmed holds both back, with the reason', [blocked['form-8843'].status, blocked['form-1040nr'].status, blocked['form-8843'].reason], ['not-ready', 'not-ready', 'Waiting for the items listed above.'])
const scholarship = makeEstimate('IN', docs, { items: [...items, { id: 'scholarship', kind: 'document', label: '1042-S', status: 'added' }], documents: [...docs, doc('scholarship', '1042-S')] })
const sch = buildForms({ year: 2025, docs, facts: FACTS, estimate: scholarship })
check('income the estimate can’t handle (a 1042-S): no 1040-NR (it says why), but Form 8843 is still ready', [sch['form-1040nr'].status, sch['form-1040nr'].reason, sch['form-8843'].status], ['not-ready', 'We can’t include 1042-S in the estimate yet.', 'ready'])
const y2024 = buildForms({ year: 2024, docs, facts: FACTS, estimate: { ...makeEstimate('IN'), year: 2024 } })
check('a tax year with no forms (2024): neither, with a plain message', [y2024['form-8843'].status, y2024['form-1040nr'].reason], ['not-ready', 'We can’t prepare this tax year yet.'])
const hidden = hideNumbers(makeEstimate('IN'))
check('"Show estimate number" off: the 1040-NR is withheld (it is the amounts), Form 8843 still ready', [buildForms({ year: 2025, docs, facts: FACTS, estimate: hidden })['form-1040nr'].status, buildForms({ year: 2025, docs, facts: FACTS, estimate: hidden })['form-8843'].status], ['not-ready', 'ready'])
check('…and the estimate’s own list says so when the number is hidden', hideNumbers({ ...makeEstimate('IN'), forms: formStatuses(forms('IN'), 2025) }).forms.map((f) => [f.id, f.status, f.blank === undefined]), [['form-8843', 'ready', false], ['form-1040nr', 'not-ready', true]])
check('the status list carries lines to leave blank, never values', JSON.stringify(formStatuses(forms('IN'), 2025)).includes('38,450') || JSON.stringify(formStatuses(forms('IN'), 2025)).includes('SAMPLE'), false)

console.log('\nMINE: what the browser sends is cleaned, not trusted\n')
check('junk facts become safe defaults', cleanFacts({ visa: 'B-2', citizenship: 'Narnia', days: { '2025': 9999, abc: 1, '2024': 12 }, daysComplete: 'yes', studentYears: [2024, 'x', 1], inScope: 'maybe' }), { ...EMPTY_FACTS, days: { '2024': 12 }, studentYears: [2024] })
check('good facts pass through (region code upper-cased)', cleanFacts({ ...FACTS, citizenship: 'in' }), FACTS)
check('small helpers: name split, dates, visa codes, countries', [splitName('SAMPLE PERSON'), splitName('Ana Maria Lopez'), toMDY('2025-08-15'), toMDY('15/08/2025'), visaLabel('F1'), visaLabel('j-1'), countryName('IN'), countryName('CN'), countryName('ZZZ')], [{ first: 'SAMPLE', last: 'PERSON' }, { first: 'Ana Maria', last: 'Lopez' }, '08/15/2025', null, 'F-1', 'J-1', 'India', 'China', null])

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: the generated PDFs\n')
const inflate = (o: unknown) => {
  if (!(o instanceof PDFRawStream)) return null
  try {
    return Buffer.from(decodePDFRawStream(o).decode())
  } catch {
    return Buffer.from(o.contents)
  }
}
const allStreams = (d: PDFDocument) => [...d.context.enumerateIndirectObjects()].map(([, o]) => inflate(o)).filter((b): b is Buffer => !!b)
const pageContent = (d: PDFDocument, pageIndex: number) => {
  const c = d.getPage(pageIndex).node.Contents()
  const refs = c instanceof PDFArray ? c.asArray() : c ? [c] : []
  return Buffer.concat(refs.map((r) => inflate(d.context.lookup(r)) ?? Buffer.alloc(0)))
}
/** Page text and the look of each form field: what a person can see (not the fonts' glyph tables) */
const shownStreams = (d: PDFDocument): Buffer[] => {
  const out: Buffer[] = d.getPages().map((_, i) => pageContent(d, i))
  for (const fld of d.getForm().getFields()) {
    for (const w of fld.acroField.getWidgets()) {
      const ap = w.dict.lookup(PDFName.of('AP'))
      const n = ap instanceof PDFDict ? ap.get(PDFName.of('N')) : undefined
      const o = n ? d.context.lookup(n) : undefined
      if (o instanceof PDFRawStream) out.push(inflate(o)!)
      else if (o instanceof PDFDict) for (const r of o.values()) out.push(inflate(d.context.lookup(r)) ?? Buffer.alloc(0))
    }
  }
  return out
}
const hex = (s: string) => Buffer.from(s, 'latin1').toString('hex').toUpperCase()
const MARK_HEX = hex(PROTOTYPE_MARK)
const fillsIN = forms('IN')
for (const [label, fill, blankPages] of [['Form 8843', fillsIN['form-8843'], 4], ['Form 1040-NR (India)', fillsIN['form-1040nr'], 2], ['Form 1040-NR (China)', forms('CN')['form-1040nr'], 2]] as const) {
  const bytes = await renderForm(fill, 2025)
  const out = await PDFDocument.load(bytes)
  check(`${label}: a real PDF; the form's pages plus a last page listing what is left blank`, [Buffer.from(bytes.subarray(0, 5)).toString('latin1'), out.getPageCount() > blankPages], ['%PDF-', true])
  check(`${label}: "${PROTOTYPE_MARK}" is on EVERY page (${out.getPageCount()} of ${out.getPageCount()})`, Array.from({ length: out.getPageCount() }, (_, i) => pageContent(out, i).toString('latin1').toUpperCase().includes(MARK_HEX)), Array(out.getPageCount()).fill(true))
  const f = out.getForm()
  const wrongValues = Object.entries(fill.values).filter(([n, x]) => (x === true ? !f.getCheckBox(n).isChecked() : f.getTextField(n).getText() !== x))
  check(`${label}: every field holds exactly what the fill says, boxes ticked`, wrongValues.map((w) => w[0]), [])
  const empty = f.getFields().filter((fld) => !(fld.getName() in fill.values) && ((fld instanceof PDFTextField && (fld.getText() ?? '') !== '') || (fld instanceof PDFCheckBox && fld.isChecked())))
  check(`${label}: nothing else is filled in (the blanks are really blank)`, empty.map((e) => e.getName()), [])
  const streams = allStreams(out)
  const leaked = WHOLE.filter((s) => streams.some((b) => b.includes(s) || b.toString('latin1').toUpperCase().includes(hex(s))) || Buffer.from(bytes).includes(s))
  check(`${label}: not one byte of the file holds a full ID number (read as text and as hex, in every stream)`, leaked, [])
  const shown = shownStreams(out)
  check(`${label}: nor the middle digits of one, in anything the form shows (page text, field appearances, field values)`, FORBIDDEN.filter((s) => shown.some((b) => b.includes(s) || b.toString('latin1').toUpperCase().includes(hex(s))) || f.getFields().some((fld) => fld instanceof PDFTextField && (fld.getText() ?? '').includes(s))), [])
  const xfa = out.catalog.lookup(PDFName.of('AcroForm'), PDFDict).get(PDFName.of('XFA'))
  check(`${label}: the XFA copy and the Reader-extensions signature are dropped (values show in every viewer)`, [xfa === undefined, out.catalog.get(PDFName.of('Perms')) === undefined], [true, true])
  check(`${label}: the file's title says prototype, and it carries no author`, [out.getTitle()?.includes(PROTOTYPE_MARK), out.getAuthor() ?? ''], [true, ''])
}
const lastPage = async (fill: FormFill) => {
  const out = await PDFDocument.load(await renderForm(fill, 2025))
  return pageContent(out, out.getPageCount() - 1).toString('latin1').toUpperCase()
}
check('the last page has the headings "Left blank", "Please check", "Not included"', await (async () => { const t = await lastPage(fillsIN['form-1040nr']); return ['Left blank (fill in by hand if you ever file)', 'Please check', 'Not included'].map((h) => t.includes(hex(h))) })(), [true, true, true])
let refused = ''
try {
  await renderForm({ ...fillsIN['form-8843'], status: 'not-ready' }, 2025)
} catch (e) {
  refused = (e as { code?: string }).code ?? 'other'
}
check('a form that is not ready is refused (it is never half-made)', refused, 'not-ready')

// ---------------------------------------------------------------------------------------------
console.log('\nMINE: the server: made in memory, nothing saved, nothing logged\n')
const dataDir = await mkdtemp(join(tmpdir(), 'atlastax-forms-'))
const app = createApp({ dataDir, consentRequired: false, dev: true })
const server = createServer((req, res) => app(req, res))
await new Promise<void>((r) => server.listen(0, r))
const base = `http://localhost:${(server.address() as { port: number }).port}`
const logs: string[] = []
const real = { log: console.log, error: console.error, warn: console.warn, info: console.info }
const walk = async (dir: string): Promise<string[]> => (await readdir(dir, { withFileTypes: true }).catch(() => [])).flatMap((e) => (e.isDirectory() ? [] : [join(dir, e.name)])).concat(...(await Promise.all((await readdir(dir, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => walk(join(dir, e.name))))))
try {
  let cookie = ''
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(base + path, { ...init, headers: { cookie, ...((init.headers as Record<string, string>) ?? {}) } })
    const sc = r.headers.get('set-cookie')
    if (sc) cookie = sc.split(';')[0]
    return r
  }
  await call('/api/consent')
  await call('/api/extraction/scenario', { method: 'POST', body: JSON.stringify({ scenario: 'fast' }) })
  for (const item of ['passport', 'i94', 'opt-cpt']) await call('/api/files', { method: 'POST', body: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64)]), headers: { 'x-item-id': item, 'x-tax-year': '2025', 'x-file-name': `${item}.pdf` } })
  await call('/api/extraction/start?year=2025', { method: 'POST' })
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250))
    const s = (await (await call('/api/extraction?year=2025')).json()) as { documents: { status: string }[] }
    if (s.documents.length && s.documents.every((d) => d.status === 'done')) break
  }
  const reviewDocs = ((await (await call('/api/review?year=2025')).json()) as { documents: { itemId: string; form: FormType }[] }).documents
  for (const d of reviewDocs) await call(`/api/review/${d.itemId}?year=2025`, { method: 'PUT', body: JSON.stringify({ fields: Object.fromEntries(FIELDS[d.form].map((s) => [s.key, { ticked: true }])), status: 'confirmed' }) })
  const request = { person: { citizenship: 'IN', visa: 'F-1' }, income: ['opt-cpt'], items: items.map(({ id, kind, label, status }) => ({ id, kind, label: label === 'W-2' ? 'W-2' : label, status })), facts: FACTS }

  const filesBefore = await walk(dataDir)
  // from here on, anything logged is a failure: capture it
  for (const k of Object.keys(real) as (keyof typeof real)[]) console[k] = (...a: unknown[]) => void logs.push(String(a[0]))
  const nr = await call('/api/forms/form-1040nr?year=2025&numbers=1', { method: 'POST', body: JSON.stringify(request) })
  const nrBytes = Buffer.from(await nr.arrayBuffer())
  const f8843 = await call('/api/forms/form-8843?year=2025&numbers=1', { method: 'POST', body: JSON.stringify(request) })
  const f8843Bytes = Buffer.from(await f8843.arrayBuffer())
  const hiddenNR = await call('/api/forms/form-1040nr?year=2025&numbers=0', { method: 'POST', body: JSON.stringify(request) })
  const hidden8843 = await call('/api/forms/form-8843?year=2025&numbers=0', { method: 'POST', body: JSON.stringify(request) })
  const est = (await (await call('/api/estimate?year=2025&numbers=1', { method: 'POST', body: JSON.stringify(request) })).json()) as Estimate
  const estOff = (await (await call('/api/estimate?year=2025&numbers=0', { method: 'POST', body: JSON.stringify(request) })).json()) as Estimate
  const noCookie = await fetch(`${base}/api/forms/form-1040nr?year=2025`, { method: 'POST', body: JSON.stringify(request) })
  const crossSite = await call('/api/forms/form-1040nr?year=2025', { method: 'POST', body: JSON.stringify(request), headers: { origin: 'https://example.org' } })
  const badId = await call('/api/forms/form-9999?year=2025', { method: 'POST', body: JSON.stringify(request) })
  const badBody = await call('/api/forms/form-8843?year=2025', { method: 'POST', body: '{"nope":1}' })
  for (const k of Object.keys(real) as (keyof typeof real)[]) console[k] = real[k]
  const filesAfter = await walk(dataDir)

  check('the 1040-NR comes back as a PDF attachment named for the prototype, never cached', [nr.status, nr.headers.get('content-type'), nr.headers.get('content-disposition'), nr.headers.get('cache-control')], [200, 'application/pdf', 'attachment; filename="AtlasTax-PROTOTYPE-Form-1040-NR-2025.pdf"', 'no-store'])
  check('Form 8843 too', [f8843.status, f8843.headers.get('content-disposition')], [200, 'attachment; filename="AtlasTax-PROTOTYPE-Form-8843-2025.pdf"'])
  const nrDoc = await PDFDocument.load(nrBytes)
  const nrForm = nrDoc.getForm()
  check('what was confirmed through the real review flow ends up in the PDF: wages, the India deduction, tax, the refund, the masked ID', [F1040NR.line1a, F1040NR.line12, F1040NR.line16, F1040NR.line34, F1040NR.id].map((n) => nrForm.getTextField(n).getText()), ['38,450', '15,750', '2,489', '697', '•••••6789'])
  const f8843Form = (await PDFDocument.load(f8843Bytes)).getForm()
  check('Form 8843 from the real flow: masked TIN and passport, line 1a from the I-94', [F8843.tin, F8843.line3b, F8843.line1a].map((n) => f8843Form.getTextField(n).getText()), ['•••-••-6789', '•••••4567', 'F-1, entered 08/15/2025'])
  check('both files: every page marked, no full ID anywhere in the bytes', await Promise.all([nrBytes, f8843Bytes].map(async (b) => { const d = await PDFDocument.load(b); return Array.from({ length: d.getPageCount() }, (_, i) => pageContent(d, i).toString('latin1').toUpperCase().includes(MARK_HEX)).every(Boolean) && !WHOLE.some((s) => allStreams(d).some((x) => x.includes(s) || x.toString('latin1').toUpperCase().includes(hex(s))) || b.includes(s)) && !FORBIDDEN.some((s) => shownStreams(d).some((x) => x.includes(s) || x.toString('latin1').toUpperCase().includes(hex(s)))) })), [true, true])
  check('NOTHING WAS SAVED: the data folder holds exactly the same files after both downloads (no PDF, no copy)', filesAfter, filesBefore)
  check('NOTHING WAS LOGGED while forms were made (not a line, not a warning)', logs, [])
  check('"Show estimate number" off: the 1040-NR is refused (409), Form 8843 still comes (200)', [hiddenNR.status, ((await hiddenNR.json()) as { error: string }).error, hidden8843.status], [409, 'numbers-hidden', 200])
  check('the estimate lists what each form leaves blank (line names only, no values), and the 8843 is ready, the 1040-NR ready', [est.forms.map((f) => [f.id, f.status]), est.forms.every((f) => (f.blank?.length ?? 0) > 0)], [[['form-8843', 'ready'], ['form-1040nr', 'ready']], true])
  check('…with the number off, no amount and the 1040-NR not ready', [estOff.forms.map((f) => [f.id, f.status]), /3845000|248900|318600|2270000|69700|1575000|38,450|2,489|22,700|3,186/.test(JSON.stringify(estOff))], [[['form-8843', 'ready'], ['form-1040nr', 'not-ready']], false])
  check('no cookie, another website, an unknown form, a malformed body: all refused, no PDF', [(noCookie.status === 409 || noCookie.status === 400) && noCookie.headers.get('content-type') !== 'application/pdf', crossSite.status, badId.status === 404 || badId.status === 400, badBody.status], [true, 403, true, 400])
} finally {
  for (const k of Object.keys(real) as (keyof typeof real)[]) console[k] = real[k]
  server.close()
  await rm(dataDir, { recursive: true, force: true })
}

console.log('\nMINE: the code itself saves nothing and logs nothing\n')
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const noEffects = ['server/forms.ts', 'src/forms/index.ts', 'src/forms/map-8843.ts', 'src/forms/map-1040nr.ts', 'src/forms/data.ts', 'src/forms/clean.ts'].filter((f) => /writeFile|createWriteStream|appendFile|mkdir|console\.|localStorage|sessionStorage|indexedDB/.test(src(f)))
check('server/forms.ts and src/forms/* have no file writes, no logging, no browser storage', noEffects, [])
check('the browser helper keeps the PDF only as a temporary link, and uses no storage', [/revokeObjectURL/.test(src('src/forms/client.ts')), /localStorage|sessionStorage|indexedDB/.test(src('src/forms/client.ts'))], [true, false])
check('the forms route in server/app.ts never logs', /api\/forms[\s\S]{0,2000}console\./.test(src('server/app.ts')), false)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll forms checks passed.')
process.exit(failed ? 1 : 0)
