// Real-click audit of the "What to do next" sheet on /result.
//
//   - no sheet until something is downloaded; then it slides up, once per download (three downloads → three sheets)
//   - amount owed: print, attach, mail, pay (no refund step); refund: print, attach, mail, refund (no pay step)
//   - both mailing addresses, the official payment link, the due date as upcoming
//   - "E-file" (labelled Concept) only shows "E-file is coming soon": nothing else happens
//   - the X, "Done" and Escape close it, and focus goes back to the Download button
// Fake documents only (the development server's mock reader). Run with the dev server up:
//   npm run dev        (in one terminal)
//   npm run audit:nextsteps
import { chromium } from 'playwright-core'
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

/** A fresh session with the fake W-2, passport and I-94 confirmed, on /result. `lived`: India → refund, Brazil → owes */
async function resultPage(lived) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
  const page = await context.newPage()
  const answers = { visa: 'F-1', enrolled: 'yes', state: 'NY', citizenship: 'BR', livedBefore: lived, marital: 'single', digitalAssets: 'no', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'no' }, taxId: 'ssn', filedBefore: 'no', income: ['opt-cpt'], details: { 'opt-type': 'opt', 'opt-w2': ['W-2.pdf'], 'passport-upload': ['Passport.pdf'], 'i94-upload': ['I-94.pdf'] } }
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
  await page.goto(`${BASE}/result`, { waitUntil: 'load' })
  await page.getByRole('button', { name: /Download Form 1040-NR/ }).waitFor()
  return { context, page }
}

const sheet = (page) => page.getByRole('dialog', { name: 'What to do next' })
const sheetOpen = (page) => sheet(page).isVisible().catch(() => false)
const download = async (page, name) => {
  const button = page.getByRole('button', { name: new RegExp(`Download ${name}`) })
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), button.click()])
  await dl.cancel().catch(() => {})
  await page.waitForTimeout(900)
}
const steps = (page) => sheet(page).locator('li[data-step]').evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))
const onTop = (page) =>
  page.evaluate(() => {
    const d = [...document.querySelectorAll('dialog[open]')].find((x) => x.querySelector('h2')?.textContent === 'What to do next')
    // the Close (X) button is always in view at the top of the sheet; "Done" can sit below the fold of a scrolling sheet
    const b = d && d.querySelector('button[aria-label="Close"]')
    if (!b) return false
    const r = b.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!el && b.contains(el)
  })

console.log('AMOUNT OWED (lived in Brazil: the fake W-2 owes $1,193)\n')
{
  const { context, page } = await resultPage('BR')
  check('no sheet until something is downloaded', !(await sheetOpen(page)))
  await download(page, 'Form 1040-NR')
  check('after the download the sheet slides up, titled “What to do next”', await sheetOpen(page))
  check('…and it is on top of the page', await onTop(page))
  check('the steps: print, attach, mail, pay (no refund step)', JSON.stringify(await steps(page)) === JSON.stringify(['print', 'attach', 'mail', 'pay']), JSON.stringify(await steps(page)))
  const text = await sheet(page).innerText()
  check('the due date is shown as upcoming, with no late-filing words', /due April 15, 2026/.test(text) && !/late|penalt|overdue|past due/i.test(text), text.slice(0, 200))
  check('both mailing addresses, exactly as printed in the instructions', ['Austin, TX 73301-0215', 'P.O. Box 1303', 'Charlotte, NC 28201-1303'].every((t) => text.includes(t)))
  check('the IRS’s own payment page is linked', (await sheet(page).locator('a[href="https://www.irs.gov/payments"]').count()) === 1)
  check('each step shows the page it comes from', (await sheet(page).locator('li[data-step]').evaluateAll((els) => els.every((e) => /(page|pages) \d+/.test(e.textContent ?? '')))) === true)
  const efile = sheet(page).getByRole('button', { name: /E-file/ })
  check('the E-file button is labelled as a concept', /Concept/.test(await efile.innerText()))
  check('no note until it is tapped', !(await sheet(page).innerText()).includes('E-file is coming soon'))
  await efile.click()
  check('tapping E-file shows the small note “E-file is coming soon”', (await sheet(page).innerText()).includes('E-file is coming soon'))
  check('…and nothing else happens: the sheet is still open, same steps, no navigation', (await sheetOpen(page)) && page.url().endsWith('/result') && JSON.stringify(await steps(page)) === JSON.stringify(['print', 'attach', 'mail', 'pay']))
  await sheet(page).getByLabel('Close').click()
  await page.waitForTimeout(900)
  check('the X closes it', !(await sheetOpen(page)))
  check('focus goes back to the Download button', await page.evaluate(() => /Download/.test(document.activeElement?.textContent ?? '')))
  await download(page, 'Form 1040-NR')
  check('downloading again opens it again (once per download)', await sheetOpen(page))
  check('the note is gone in the new one (it starts fresh)', !(await sheet(page).innerText()).includes('E-file is coming soon'))
  await sheet(page).getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(900)
  check('“Done” closes it', !(await sheetOpen(page)))
  await download(page, 'Form 8843')
  check('a download of Form 8843 opens it too', await sheetOpen(page))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(900)
  check('Escape closes it', !(await sheetOpen(page)))
  await context.close()
}

console.log('\nREFUND (lived in India: the fake W-2 gets $697 back)\n')
{
  const { context, page } = await resultPage('IN')
  await download(page, 'Form 1040-NR')
  check('the steps: print, attach, mail, refund (no pay step)', JSON.stringify(await steps(page)) === JSON.stringify(['print', 'attach', 'mail', 'refund']), JSON.stringify(await steps(page)))
  const text = await sheet(page).innerText()
  check('the refund step says what the IRS does, with no timing', text.includes('The IRS sends your refund after it processes your return') && !/\b(days?|weeks?|months?|fast|quick|soon)\b/i.test(text.split('Your refund')[1] ?? ''))
  check('no payment link on a refund', (await sheet(page).locator('a[href*="irs.gov"]').count()) === 0)
  await context.close()
}

await browser.close()
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll next-steps audits passed.')
process.exit(failed ? 1 : 0)
