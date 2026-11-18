// Real-click audit of the E-file concept screen (/result/efile), reached from "Want to e-file instead?" on /result.
//   - labelled "Concept: not connected to the IRS"; a wallet illustration; "Amount owed" or "Your refund" with the amount
//   - on open: a card slides into the wallet, then the amount counts up (about 600ms); reduced motion: fade only, no movement
//   - owed: Debit or credit card, Bank account (each goes to the celebration screen), Pay by check (opens the sheet)
//   - refund: Direct deposit (celebration), Paper check by mail (opens the sheet)
// Fake documents only (the development server's mock reader). Run with the dev server up:
//   npm run dev        (in one terminal)
//   npm run audit:efile
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
async function resultPage(lived, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, ...opts })
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

/** Press "E-file" on the result page and sample the wallet card's transform and the amount while it plays */
async function openAndSample(page, times) {
  await page.getByRole('button', { name: 'E-file', exact: true }).click()
  const samples = []
  const t0 = Date.now()
  for (const t of times) {
    const wait = t - (Date.now() - t0)
    if (wait > 0) await page.waitForTimeout(wait)
    samples.push(
      await page.evaluate(() => {
        const g = document.querySelector('[data-wallet-card]')
        const amt = document.querySelector('[data-amount] p.font-display')
        return { transform: g ? getComputedStyle(g).transform : null, opacity: g ? getComputedStyle(g).opacity : null, amount: amt?.querySelector('[aria-hidden]')?.textContent ?? null }
      }),
    )
  }
  return samples
}

console.log('AMOUNT OWED (lived in Brazil: the fake W-2 owes $1,193)\n')
{
  const { context, page } = await resultPage('BR')
  const samples = await openAndSample(page, [60, 200, 420, 560, 1100])
  check('the button opens /result/efile', new URL(page.url()).pathname === '/result/efile')
  check('the label says “Concept: not connected to the IRS”', await page.getByText('Concept: not connected to the IRS', { exact: true }).isVisible())
  check('a wallet illustration is on the page, with no text inside it', (await page.locator('svg[data-wallet]').count()) === 1 && (await page.locator('svg[data-wallet] text').count()) === 0)
  check('early on, the card has not settled (it is moving or still hidden) and the amount is not final yet', samples[0].transform !== 'none' || samples[0].opacity !== '1', JSON.stringify(samples[0]))
  check('the card ends settled and fully visible', samples[4].opacity === '1' && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(samples[4].transform ?? ''), JSON.stringify(samples[4]))
  check('the amount counts up: it is below the final number mid-way, and $1,193 at the end', samples[1].amount !== '$1,193' && samples[4].amount === '$1,193', JSON.stringify(samples.map((s) => s.amount)))
  const text = await page.locator('main').innerText()
  check('it says “Amount owed” with the amount, from the estimate', /Amount owed/.test(text) && /\$1,193/.test(text))
  check('the rows are Debit or credit card and Bank account, and a small “Pay by check” link', (await page.getByRole('button', { name: 'Debit or credit card' }).count()) === 1 && (await page.getByRole('button', { name: 'Bank account' }).count()) === 1 && (await page.getByRole('button', { name: 'Pay by check' }).count()) === 1)
  check('no refund options on an owed amount', (await page.getByRole('button', { name: /Direct deposit|Paper check/ }).count()) === 0)
  check('no “Coming soon” on the screen any more', !text.includes('Coming soon'))
  await page.getByRole('button', { name: 'Debit or credit card' }).click()
  await page.waitForURL('**/result/efile/done*')
  await page.waitForTimeout(1900)
  const done = await page.locator('main').innerText()
  check('a card tap goes straight to the celebration, no details asked', new URL(page.url()).pathname === '/result/efile/done')
  check('headline “Your 2025 taxes are done”, in the display font', (await page.getByRole('heading', { level: 1 }).innerText()) === 'Your 2025 taxes are done' && (await page.getByRole('heading', { level: 1 }).evaluate((e) => getComputedStyle(e).fontFamily)).includes('Fraunces'))
  check('the concept label stays visible', done.includes('Concept: not connected to the IRS'))
  check('no “filed”, “accepted”, “IRS confirm”, and no refund timing or promises', !/\bfiled\b|accepted|confirm|\b(days?|weeks?|fast|quick|instant|guarantee)\b/i.test(done.replace('Concept: not connected to the IRS', '')), done)
  check('focus is on the headline', await page.evaluate(() => document.activeElement?.tagName === 'H1'))
  check('a live region announces it', (await page.locator('[role="status"]').innerText()).includes('Your 2025 taxes are done'))
  check('confetti is on the page (28 pieces) and then gone from view (faded out)', (await page.locator('span.absolute.block').count()) === 28 && (await page.locator('span.absolute.block').evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === '0'))))
  check('“Done” (cobalt) and “Download my forms” are at least 44pt tall', await page.evaluate(() => [...document.querySelectorAll('main button, main a')].filter((e) => /^(Done|Download my forms)$/.test(e.textContent ?? '')).every((e) => e.getBoundingClientRect().height >= 43.5)))
  check('no horizontal scroll on the celebration', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.getByRole('link', { name: 'Download my forms' }).click()
  await page.getByRole('button', { name: /Download Form 1040-NR/ }).waitFor()
  check('“Download my forms” goes to /result', new URL(page.url()).pathname === '/result')
  await page.goBack()
  await page.goBack()
  await page.getByRole('button', { name: /^Bank account/ }).waitFor()
  await page.getByRole('button', { name: /^Bank account/ }).click()
  await page.waitForURL('**/result/efile/done*')
  check('a bank tap goes to the celebration too', new URL(page.url()).pathname === '/result/efile/done')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForTimeout(500)
  check('“Done” goes to Home', new URL(page.url()).pathname === '/')
  await page.goBack()
  await page.goBack()
  await page.getByRole('button', { name: 'Pay by check' }).waitFor()
  await page.getByRole('button', { name: 'Pay by check' }).click()
  await page.waitForTimeout(900)
  check('“Pay by check” opens “What to do next”', await sheetOpen(page))
  await sheet(page).getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(900)
  check('closing it leaves you on the E-file screen', !(await sheetOpen(page)) && new URL(page.url()).pathname === '/result/efile')
  check('every row is at least 44pt tall', await page.evaluate(() => [...document.querySelectorAll('main button')].every((b) => b.getBoundingClientRect().height >= 43.5)))
  check('no horizontal scroll on a phone', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check('no solid cobalt anywhere on the screen (the primary button is the only cobalt, and it is not on this screen)', await page.evaluate(() => ![...document.querySelectorAll('main *')].some((e) => getComputedStyle(e).backgroundColor === 'rgb(31, 79, 216)')))
  check('no brand names, no promises about speed or fees', !/visa|mastercard|amex|paypal|venmo|zelle|\bfast\b|instant|\bfree\b|no fee|same day/i.test(await page.locator('main').innerText()))
  await page.keyboard.press('Tab')
  await page.goBack()
  await page.getByRole('button', { name: /Download Form 1040-NR/ }).waitFor()
  check('Back goes to the result page', new URL(page.url()).pathname === '/result')
  await context.close()
}

console.log('\nREDUCED MOTION\n')
{
  const { context, page } = await resultPage('BR', { reducedMotion: 'reduce' })
  const samples = await openAndSample(page, [40, 120, 250, 500])
  check('the card never moves: no transform at any moment', samples.every((s) => /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(s.transform ?? '')), JSON.stringify(samples.map((s) => s.transform)))
  check('the amount is final from the start (no counting)', samples.every((s) => s.amount === '$1,193'), JSON.stringify(samples.map((s) => s.amount)))
  await page.goto(page.url().replace('/result/efile', '/result/efile/done'), { waitUntil: 'load' })
  await page.waitForTimeout(600)
  check('reduced motion: no confetti, but the check and headline are there', (await page.locator('span.absolute.block').count()) === 0 && (await page.getByRole('heading', { level: 1 }).isVisible()))
  await context.close()
}

console.log('\nREFUND (lived in India: the fake W-2 gets $697 back)\n')
{
  const { context, page } = await resultPage('IN')
  await openAndSample(page, [1100])
  const text = await page.locator('main').innerText()
  check('it says “Your refund” with $697', /Your refund/.test(text) && /\$697/.test(text))
  check('the rows are Direct deposit and Paper check by mail; no card, bank or Pay by check', (await page.getByRole('button', { name: /^Direct deposit/ }).count()) === 1 && (await page.getByRole('button', { name: /^Paper check by mail/ }).count()) === 1 && (await page.getByRole('button', { name: /Debit or credit card|^Bank account|Pay by check/ }).count()) === 0)
  await page.getByRole('button', { name: /^Direct deposit/ }).click()
  await page.waitForURL('**/result/efile/done*')
  check('Direct deposit goes to the celebration', new URL(page.url()).pathname === '/result/efile/done')
  await page.goBack()
  await page.getByRole('button', { name: /^Paper check by mail/ }).waitFor()
  await page.getByRole('button', { name: /^Paper check by mail/ }).click()
  await page.waitForTimeout(900)
  check('Paper check by mail opens “What to do next” (with the refund step)', (await sheetOpen(page)) && (await sheet(page).innerText()).includes('Your refund'))
  await context.close()
}

await browser.close()
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll e-file audits passed.')
process.exit(failed ? 1 : 0)
