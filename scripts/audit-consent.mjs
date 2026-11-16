// Real-click audit of the privacy sheet ("Before you add a document") on the Documents page.
//
//   1. Add → the privacy sheet opens, on top.
//   2. "Not now" → everything closes.
//   3. Add again → the privacy sheet comes back BY ITSELF, on top (not hidden behind the upload sheet).
//   4. Continue to upload → the privacy sheet closes, the upload sheet is usable.
//   5. Upload a file → it goes through (and no file was sent before step 4).
// Then the same again with "Not now" pressed several times in a row, and with Escape and the X
// (both mean "Not now"). "On top" is measured: the element under the middle of the privacy
// sheet's button must be the button itself, not the upload sheet.
//
// Run with the dev server up:
//   npm run dev        (in one terminal)
//   npm run audit:consent
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://localhost:5173'
try {
  await fetch(BASE)
} catch {
  console.error(`Can't reach ${BASE}. Start the app with "npm run dev" first.`)
  process.exit(1)
}

const answers = { visa: 'F-1', enrolled: 'yes', state: 'NY', citizenship: 'FR', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'no' }, taxId: 'ssn', filedBefore: 'no', income: ['opt-cpt'] }
const PRIVACY = 'Before you add a document'
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`)
  if (!ok) failed++
}

const browser = await chromium.launch({ channel: 'chrome' })

async function fresh() {
  // A new browser context = a new session that has not agreed to anything
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const sent = []
  page.on('request', (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/files' && sent.push(Date.now()))
  await page.goto(`${BASE}/documents`, { waitUntil: 'load' })
  await page.evaluate((a) => sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: a } })), answers)
  await page.goto(`${BASE}/documents`, { waitUntil: 'load' })
  await page.getByRole('button', { name: /^Add/ }).first().waitFor()
  return { context, page, sent }
}

const open = (page) => page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((d) => d.querySelector('h2')?.textContent ?? ''))
const settle = (page) => page.waitForTimeout(900)
/** The privacy sheet is the top layer: the topmost thing under its main button is that button */
const privacyOnTop = (page) =>
  page.evaluate((title) => {
    const d = [...document.querySelectorAll('dialog[open]')].find((x) => x.querySelector('h2')?.textContent === title)
    const b = d && [...d.querySelectorAll('button')].find((x) => x.textContent === 'Continue to upload')
    if (!b) return false
    const r = b.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!el && b.contains(el)
  }, PRIVACY)

console.log('NOT NOW, THEN ADD AGAIN, THEN CONTINUE, THEN UPLOAD A FILE\n')
{
  const { context, page, sent } = await fresh()
  await page.getByRole('button', { name: /^Add/ }).first().click(); await settle(page)
  check('Add: the privacy sheet opens, on top', (await open(page)).includes(PRIVACY) && (await privacyOnTop(page)), JSON.stringify(await open(page)))
  await page.getByRole('button', { name: 'Not now' }).click(); await settle(page)
  check('Not now: every sheet closes', (await open(page)).length === 0, JSON.stringify(await open(page)))
  await page.getByRole('button', { name: /^Add/ }).first().click(); await settle(page)
  check('Add again: the privacy sheet comes back by itself', (await open(page)).includes(PRIVACY), JSON.stringify(await open(page)))
  check('…and it is ON TOP of the upload sheet (not stuck behind it)', await privacyOnTop(page))
  check('no file has been sent yet', sent.length === 0)
  await page.getByRole('button', { name: 'Continue to upload' }).click({ timeout: 4000 }).catch((e) => check('Continue to upload can be pressed', false, e.message.split('\n')[0]))
  await settle(page)
  check('Continue to upload: the privacy sheet closes, the upload sheet stays', JSON.stringify(await open(page)) === JSON.stringify(['Add: Passport']), JSON.stringify(await open(page)))
  check('still no file sent (nothing leaves before agreeing, and agreeing alone sends nothing)', sent.length === 0)
  await page.locator('input[type=file]').first().setInputFiles({ name: 'passport.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') })
  await page.waitForFunction(() => /uploaded|Added|passport\.pdf/i.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {})
  check('upload a file: it is sent, once', sent.length === 1, `files sent: ${sent.length}`)
  check('…and the page shows it', await page.getByText('passport.pdf').first().isVisible().catch(() => false))
  await context.close()
}

console.log('\nNOT NOW SEVERAL TIMES IN A ROW, EACH ATTEMPT STARTS FRESH\n')
{
  const { context, page, sent } = await fresh()
  for (let i = 1; i <= 3; i++) {
    await page.getByRole('button', { name: /^Add/ }).first().click(); await settle(page)
    check(`attempt ${i}: the privacy sheet is open and on top`, (await open(page)).includes(PRIVACY) && (await privacyOnTop(page)), JSON.stringify(await open(page)))
    await page.getByRole('button', { name: 'Not now' }).click(); await settle(page)
    check(`attempt ${i}: Not now closes everything`, (await open(page)).length === 0, JSON.stringify(await open(page)))
  }
  check('no file sent after three refusals', sent.length === 0)
  await context.close()
}

console.log('\nESCAPE AND THE X ALSO MEAN "NOT NOW"\n')
{
  const { context, page, sent } = await fresh()
  await page.getByRole('button', { name: /^Add/ }).first().click(); await settle(page)
  await page.keyboard.press('Escape'); await settle(page)
  check('Escape on the privacy sheet: everything closes', (await open(page)).length === 0, JSON.stringify(await open(page)))
  await page.getByRole('button', { name: /^Add/ }).first().click(); await settle(page)
  check('Add after Escape: the privacy sheet is back, on top', (await open(page)).includes(PRIVACY) && (await privacyOnTop(page)))
  await page.getByRole('dialog', { name: PRIVACY }).getByLabel('Close').click(); await settle(page)
  check('the X on the privacy sheet: everything closes', (await open(page)).length === 0, JSON.stringify(await open(page)))
  await page.getByRole('button', { name: /^Add/ }).first().click(); await settle(page)
  check('Add after the X: the privacy sheet is back, on top', (await open(page)).includes(PRIVACY) && (await privacyOnTop(page)))
  check('no file sent', sent.length === 0)
  await context.close()
}

await browser.close()
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll consent audits passed.')
process.exit(failed ? 1 : 0)
