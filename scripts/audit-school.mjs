// Real-click audit of the school / program director question and the green card question (Time in the U.S.), and that
// Form 8843 lines 9, 10 and 13 hold them. Fake school and director only (the sample details the upload fills in).
//   npm run dev        (in one terminal)
//   npm run audit:school
import { chromium } from 'playwright-core'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'
import { F8843 } from '../src/forms/map-8843.ts'
import { FIELDS } from '../src/extraction.config.ts'

const BASE = process.env.BASE ?? 'http://localhost:5173'
try {
  await fetch(BASE)
} catch {
  console.error(`Can't reach ${BASE}. Start the app with "npm run dev" first.`)
  process.exit(1)
}
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`)
  if (!ok) failed++
}
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
const page = await context.newPage()
const answers = { visa: 'F-1', enrolled: 'yes', state: 'NY', citizenship: 'BR', livedBefore: 'BR', marital: 'single', digitalAssets: 'no', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'no' }, taxId: 'ssn', filedBefore: 'no', income: ['opt-cpt'], details: { 'opt-type': 'opt', 'opt-w2': ['W-2.pdf'], 'passport-upload': ['Passport.pdf'], 'i94-upload': ['I-94.pdf'] } }
await page.goto(`${BASE}/documents`, { waitUntil: 'load' })
const fields = Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v.map((f) => f.key)]))
await page.evaluate(
  async ([a, fields]) => {
    sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: a } }))
    const c = await (await fetch('/api/consent')).json()
    await fetch('/api/consent', { method: 'POST', body: JSON.stringify({ version: c.notice.version, fingerprint: c.notice.fingerprint }) })
    await fetch('/api/extraction/scenario', { method: 'POST', body: JSON.stringify({ scenario: 'fast' }) })
    for (const item of ['passport', 'i94', 'opt-cpt']) await fetch('/api/files', { method: 'POST', body: new Blob(['%PDF-1.4 sample']), headers: { 'x-item-id': item, 'x-tax-year': '2025', 'x-file-name': `${item}.pdf` } })
    await fetch('/api/extraction/start?year=2025', { method: 'POST' })
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250))
      const s = await (await fetch('/api/extraction?year=2025')).json()
      if (s.documents.length && s.documents.every((d) => d.status === 'done')) break
    }
    const docs = (await (await fetch('/api/review?year=2025')).json()).documents
    for (const d of docs) await fetch(`/api/review/${d.itemId}?year=2025`, { method: 'PUT', body: JSON.stringify({ fields: Object.fromEntries(fields[d.form].map((k) => [k, { ticked: true }])), status: 'confirmed' }) })
  },
  [answers, fields],
)

console.log('THE SCHOOL QUESTION\n')
await page.goto(`${BASE}/school`, { waitUntil: 'load' })
await page.getByRole('heading', { name: 'Tell us about your school' }).waitFor()
const cont = page.getByRole('button', { name: /^Continue/ })
check('Continue is locked until a school name and a program director name are in', await cont.isDisabled().catch(async () => (await cont.getAttribute('aria-disabled')) === 'true'))
check('“I’ll add it later” is offered', (await page.getByRole('button', { name: /add it later/i }).count()) + (await page.getByRole('link', { name: /add it later/i }).count()) >= 1)
await page.getByLabel('Name').first().fill('My Typed School (FAKE)')
// open the upload section and upload a file (the sample details fill the EMPTY parts only)
await page.getByText('Fill this in from your I-20 or DS-2019').click()
await page.waitForTimeout(500)
await page.locator('input[type=file]').first().setInputFiles({ name: 'I-20.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') })
await page.getByText(/Sample details: reading your file isn.t built yet/).waitFor({ timeout: 15000 })
const val = (label, nth) => page.getByLabel(label).nth(nth).inputValue()
check('what was typed is kept (the school name)', (await val('Name', 0)) === 'My Typed School (FAKE)', await val('Name', 0))
check('empty parts are filled in with sample details: school address and phone', (await val('Address', 0)).includes('Example Street') && (await val('Phone number', 0)) === '555-555-0100')
check('the program director is filled in too (name, phone), and is clearly fake', (await val('Name', 1)).includes('FAKE') && (await val('Phone number', 1)) === '555-555-0101')
check('and the page says these are sample details to check', await page.getByText(/Sample details: reading your file isn.t built yet/).isVisible())
await page.getByLabel('Phone number').first().fill('555-555-0199')
check('everything stays editable', (await val('Phone number', 0)) === '555-555-0199')
check('Continue unlocks', await cont.isEnabled())
await cont.click()
await page.getByRole('heading', { name: /did you apply for a green card/ }).waitFor()
check('then comes the green card question', true)
check('it can’t continue until answered', await page.getByRole('button', { name: /^Continue/ }).isDisabled().catch(() => false))
await page.getByRole('radio', { name: 'Yes' }).click()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Check your time in the U.S.' }).waitFor()
check('it is the last question: the summary of Time in the U.S. follows', true)

console.log('\nTHE FORM\n')
await page.goto(`${BASE}/result`, { waitUntil: 'load' })
await page.getByRole('button', { name: /Download Form 8843/ }).waitFor()
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: /Download Form 8843/ }).click()])
const path = await dl.path()
const form = (await PDFDocument.load(fs.readFileSync(path))).getForm()
check('line 9: the typed school name, the sample address, the phone as edited', form.getTextField(F8843.line9).getText() === 'My Typed School (FAKE), 1 Example Street, Sampleville, NY 10001, 555-555-0199', form.getTextField(F8843.line9).getText())
check('line 10: the sample program director (name and phone; no address)', form.getTextField(F8843.line10).getText() === 'Pat Sample (FAKE), 555-555-0101', form.getTextField(F8843.line10).getText())
check('line 13: Yes ticked, No empty', form.getCheckBox(F8843.line13Yes).isChecked() && !form.getCheckBox(F8843.line13No).isChecked())
check('line 14 (the explanation) is left blank', (form.getTextField(F8843.line14).getText() ?? '') === '')
await page.getByRole('dialog', { name: 'What to do next' }).getByLabel('Close').click().catch(() => {})
await page.getByRole('button', { name: /What’s left blank/ }).first().click().catch(() => {})
const blankText = await page.locator('main').innerText()
check('“What’s left blank” on the page: nothing for line 9, only the director’s missing address for line 10, and line 14 to write by hand (because of the Yes)', !/Line 9:/.test(blankText) && /Line 10: the address of your program director/.test(blankText) && !/Line 10: name, address and phone/.test(blankText) && /Line 14/.test(blankText), blankText.match(/Line \d+[^\n]*/g)?.join(' | '))
await context.close()

console.log('\nSKIPPING\n')
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/documents`, { waitUntil: 'load' })
  await p.evaluate((a) => sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: a } })), answers)
  await p.goto(`${BASE}/school`, { waitUntil: 'load' })
  await p.getByRole('heading', { name: 'Tell us about your school' }).waitFor()
  await p.getByText(/add it later/i).first().click()
  await p.getByRole('heading', { name: /did you apply for a green card/ }).waitFor()
  check('“I’ll add it later” moves on to the green card question', true)
  await ctx.close()
}
await browser.close()
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll school audits passed.')
process.exit(failed ? 1 : 0)
