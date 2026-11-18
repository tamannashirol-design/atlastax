// Real-click audit of "Delete my documents" (Home card, Documents link, confirmation sheet, /deleted).
//   - the "Your 2025 return is done" card shows on Home after the E-file celebration; "Keep my documents" dismisses it for good
//   - both delete buttons open a sheet that lists what goes and says "This can't be undone"; Cancel deletes nothing
//   - the shredding stage (MOTION-delete.md): the cards go into the shredder one after another while the request runs;
//     "deleted" shows only after the server confirms (a slowed answer proves it); a failing server brings the cards back with Try again
//   - tax forms only: the W-2 card is shredded, the passport and I-94 cards stay put; the server and the browser agree
//   - everything: all cards, all gone, back to a new Home; reduced motion: no shredder, the cards fade
// Fake documents only. Run with the dev server up:  npm run dev  (one terminal)   npm run audit:delete
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
const fieldKeys = Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v.map((f) => f.key)]))

/** A fresh person: answers in the tab, a W-2, a passport and an I-94 uploaded and read, and the E-file celebration reached (so Home shows the card) */
async function person(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts })
  const page = await context.newPage()
  const answers = { visa: 'F-1', enrolled: 'yes', state: 'NY', citizenship: 'BR', livedBefore: 'BR', marital: 'single', digitalAssets: 'no', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'no', schoolFiles: ['I-20.pdf'] }, taxId: 'ssn', filedBefore: 'no', income: ['opt-cpt'], details: { 'opt-type': 'opt', 'opt-w2': ['W-2.pdf'], 'passport-upload': ['Passport.pdf'], 'i94-upload': ['I-94.pdf'] } }
  await page.goto(`${BASE}/documents`, { waitUntil: 'load' })
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
        if (s.documents.length && s.documents.every((d) => d.status === 'ready' || d.status === 'done')) break
      }
      const docs = (await (await fetch('/api/review?year=2025')).json()).documents
      for (const d of docs) await fetch(`/api/review/${d.itemId}?year=2025`, { method: 'PUT', body: JSON.stringify({ fields: Object.fromEntries(fields[d.form].map((k) => [k, { ticked: true }])), status: 'confirmed' }) })
    },
    [answers, fieldKeys],
  )
  await page.goto(`${BASE}/result/efile/done`, { waitUntil: 'load' }) // reaching it marks the return done
  await page.waitForTimeout(400)
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  return { context, page }
}
const serverItems = (page) => page.evaluate(async () => (await (await fetch('/api/review?year=2025')).json()).documents.map((d) => d.itemId))
const stored = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('atlastax:returns') ?? 'null'))
const sheet = (page, name) => page.getByRole('dialog', { name })
const ok44 = (page, scope) => page.evaluate((s) => [...document.querySelectorAll(`${s} button, ${s} a`)].every((b) => b.getBoundingClientRect().height >= 43.5), scope)

console.log('THE CARD ON HOME\n')
{
  const { context, page } = await person()
  const card = page.getByRole('region', { name: 'Your 2025 return is done' })
  await card.waitFor()
  check('the card says “Your 2025 return is done” and the keep-and-delete line', (await card.innerText()).includes('We’re keeping your documents so you can reuse some of them next year. You can delete everything any time.'))
  check('three actions: Keep my documents, Delete tax forms only, Delete everything', (await Promise.all(['Keep my documents', 'Delete tax forms only', 'Delete everything'].map((n) => card.getByRole('button', { name: n }).count()))).every((c) => c === 1))
  check('the buttons are at least 44pt tall', await ok44(page, '#home-done ~ div'))
  check('Home still has exactly one cobalt button (the hero’s)', (await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).backgroundColor === 'rgb(31, 79, 216)').length)) === 1)
  await card.getByRole('button', { name: 'Keep my documents' }).click()
  await page.waitForTimeout(300)
  check('“Keep my documents” dismisses the card', (await page.getByRole('region', { name: 'Your 2025 return is done' }).count()) === 0)
  check('…and deletes nothing (all three documents still on the server)', (await serverItems(page)).length === 3)
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(500)
  check('…and it stays gone after a reload', (await page.getByRole('region', { name: 'Your 2025 return is done' }).count()) === 0)
  await context.close()
}


/** When each card first has a transform (it started to move), sampled every 50ms for `ms` */
const startTimes = (page, ids, ms) =>
  page.evaluate(
    ([ids, ms]) =>
      new Promise((resolve) => {
        const t0 = performance.now()
        const first = {}
        const moving = (id) => {
          const el = document.querySelector(`[data-card="${id}"]`)
          const t = el ? getComputedStyle(el).transform : 'none'
          return !!el && t !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t)
        }
        const tick = () => {
          for (const id of ids) if (first[id] === undefined && moving(id)) first[id] = Math.round(performance.now() - t0)
          performance.now() - t0 < ms ? setTimeout(tick, 50) : resolve(first)
        }
        tick()
      }),
    [ids, ms],
  )
const heading = (page) => page.getByRole('heading', { level: 1 }).innerText()

console.log('\nDELETE TAX FORMS ONLY (the stage, the server, the browser)\n')
{
  const { context, page } = await person()
  await page.getByRole('button', { name: 'Delete tax forms only' }).click()
  const s = sheet(page, 'Delete tax forms only?')
  await s.waitFor()
  await page.waitForTimeout(600)
  const text = await s.innerText()
  check('the sheet lists what goes and what stays, and says “This can’t be undone.”', /W-2, 1042-S and 1099 documents/.test(text) && /passport, I-20 or DS-2019, visa, I-94 and ID/.test(text) && text.includes('This can’t be undone.'))
  check('a red “Delete tax forms” button and a plain Cancel, both 44pt+', (await s.getByRole('button', { name: 'Delete tax forms' }).evaluate((e) => getComputedStyle(e).color)) === 'rgb(180, 35, 24)' && (await ok44(page, 'dialog[open]')))
  await s.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(700)
  check('Cancel closes it and deletes nothing', (await sheet(page, 'Delete tax forms only?').count()) === 0 && (await serverItems(page)).length === 3)

  // slow the server's answer so we can look at the stage before it says yes
  await page.route('**/api/data*', async (route) => {
    await new Promise((r) => setTimeout(r, 3500))
    await route.continue()
  })
  await page.getByRole('button', { name: 'Delete tax forms only' }).click()
  await s.waitFor()
  await page.waitForTimeout(600)
  await s.getByRole('button', { name: 'Delete tax forms' }).click()
  await page.waitForURL('**/deleted')
  check('the stage opens with “Deleting your documents”, focus on it, and a live “Deleting” status', (await heading(page)) === 'Deleting your documents' && (await page.evaluate(() => document.activeElement?.tagName === 'H1')) && (await page.locator('[role="status"]').innerText()).includes('Deleting'))
  check('the W-2 card is in the queue; the passport and I-94 are under “Staying”', (await page.locator('ul[aria-label="Documents being deleted"] [data-card]').allInnerTexts()).join().includes('W-2') && (await page.locator('section[aria-label="Staying"] [data-card]').count()) === 2)
  check('a shredder drawing is on the page', (await page.locator('svg[data-shredder]').count()) === 1)
  const moved = await startTimes(page, ['opt-cpt', 'passport', 'i94'], 2000)
  check('the W-2 card travels to the shredder; the ID cards never move', moved['opt-cpt'] !== undefined && moved.passport === undefined && moved.i94 === undefined, JSON.stringify(moved))
  check('strips fell (decoration is on the page) and the status counted the cards', (await page.locator('span.absolute.block').count()) >= 10)
  await page.waitForTimeout(500)
  check('the cards are done but the server has NOT answered: still “Deleting”, never “deleted”', (await heading(page)) === 'Deleting your documents' && !(await page.locator('main').innerText()).includes('deleted'))
  check('…and nothing was removed on the server yet', (await serverItems(page)).length === 3)
  await page.getByRole('heading', { name: 'Tax forms deleted' }).waitFor({ timeout: 6000 })
  check('then “Tax forms deleted”, focus on it, a live status', (await page.evaluate(() => document.activeElement?.tagName === 'H1')) && (await page.locator('[role="status"]').innerText()).includes('Tax forms deleted'))
  check('the server really deleted the W-2 and kept the passport and I-94', JSON.stringify((await serverItems(page)).sort()) === JSON.stringify(['i94', 'passport']))
  const kept = JSON.stringify(await stored(page))
  check('the browser forgot the W-2 file name, kept the passport, I-94 and I-20 names', !kept.includes('W-2.pdf') && kept.includes('Passport.pdf') && kept.includes('I-94.pdf') && kept.includes('I-20.pdf'))
  check('a cobalt “Back to Home” button, 44pt+', await ok44(page, 'main'))
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(500)
  check('a reload keeps showing the confirmation (it was already deleted)', (await heading(page)) === 'Tax forms deleted')
  await page.getByRole('button', { name: 'Back to Home' }).click()
  await page.waitForTimeout(400)
  check('Back to Home goes to Home', new URL(page.url()).pathname === '/')
  await context.close()
}

console.log('\nA FAILING SERVER\n')
{
  const { context, page } = await person()
  await page.evaluate(() => history.replaceState(null, '', '/?fail=1')) // development switch: the server pretends to fail
  await page.getByRole('button', { name: 'Delete tax forms only' }).click()
  const s = sheet(page, 'Delete tax forms only?')
  await s.waitFor()
  await page.waitForTimeout(600)
  await s.getByRole('button', { name: 'Delete tax forms' }).click()
  await page.getByRole('alert').waitFor()
  await page.waitForTimeout(900)
  check('the error says nothing has been deleted, with “Try again”; it never says deleted', (await page.getByRole('alert').innerText()).includes('Nothing has been deleted') && (await heading(page)) === 'We couldn’t delete them' && (await page.getByRole('button', { name: 'Try again' }).count()) === 1)
  check('focus moves to the error message', await page.evaluate(() => document.activeElement?.getAttribute('role') === 'alert'))
  check('the cards are back in place and visible', await page.evaluate(() => { const el = document.querySelector('[data-card="opt-cpt"]'); const cs = getComputedStyle(el); return cs.opacity === '1' && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(cs.transform) }))
  check('nothing was removed: three documents on the server, the W-2 name still in the answers', (await serverItems(page)).length === 3 && JSON.stringify(await stored(page)).includes('W-2.pdf'))
  check('the buttons are 44pt+', await ok44(page, 'main'))
  await page.evaluate(() => history.replaceState(history.state, '', '/deleted')) // the server works again (keep the page's own state)
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByRole('heading', { name: 'Tax forms deleted' }).waitFor({ timeout: 8000 })
  check('Try again runs it all again and then confirms', JSON.stringify((await serverItems(page)).sort()) === JSON.stringify(['i94', 'passport']))
  await context.close()
}

console.log('\nDELETE EVERYTHING (from the Documents page)\n')
{
  const { context, page } = await person()
  await page.goto(`${BASE}/documents`, { waitUntil: 'load' })
  const link = page.getByRole('button', { name: 'Delete everything' })
  await link.waitFor()
  check('a quiet “Delete everything” link at the bottom of the Documents page, 44pt+', (await link.count()) === 1 && (await link.evaluate((e) => e.getBoundingClientRect().height)) >= 43.5)
  await link.click()
  const s = sheet(page, 'Delete everything?')
  await s.waitFor()
  await page.waitForTimeout(600)
  check('the sheet lists every document, what we read, and the answers; and “This can’t be undone.”', /Every document you uploaded/.test(await s.innerText()) && /Your answers, for every tax year/.test(await s.innerText()) && (await s.innerText()).includes('This can’t be undone.'))
  await s.getByRole('button', { name: 'Delete everything' }).click()
  await page.waitForURL('**/deleted')
  check('all three cards are in the queue, and there is no “Staying” row', (await page.locator('ul[aria-label="Documents being deleted"] [data-card]').count()) === 3 && (await page.locator('section[aria-label="Staying"]').count()) === 0)
  const t = await startTimes(page, ['passport', 'i94', 'opt-cpt'], 2600) // the order they are listed: identity first
  const order = ['passport', 'i94', 'opt-cpt'].map((id) => t[id])
  check('the cards go in one after another (each starts after the one before, about 450ms apart)', order.every((x) => x !== undefined) && order[0] < order[1] && order[1] < order[2] && order[1] - order[0] >= 250 && order[2] - order[1] >= 250, JSON.stringify(t))
  await page.getByRole('heading', { name: 'Everything’s been deleted' }).waitFor({ timeout: 6000 })
  check('“Everything’s been deleted”, focus on it', await page.evaluate(() => document.activeElement?.tagName === 'H1'))
  check('the server has nothing left (no documents, nothing read)', (await serverItems(page)).length === 0 && (await page.evaluate(async () => (await (await fetch('/api/extraction?year=2025')).json()).documents.length)) === 0)
  check('the browser has no answers left', JSON.stringify((await stored(page))?.years ?? {}) === '{}')
  await page.getByRole('button', { name: 'Back to Home' }).click()
  await page.waitForTimeout(600)
  check('Home is brand new again, with no “return is done” card', (await page.getByRole('region', { name: 'Your 2025 return is done' }).count()) === 0 && (await page.getByRole('button', { name: /Start/ }).count()) >= 1)
  await context.close()
}

console.log('\nREDUCED MOTION\n')
{
  const { context, page } = await person({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Delete tax forms only' }).click()
  const s = sheet(page, 'Delete tax forms only?')
  await s.waitFor()
  await page.waitForTimeout(400)
  await s.getByRole('button', { name: 'Delete tax forms' }).click()
  await page.waitForURL('**/deleted')
  await page.waitForTimeout(80)
  check('no shredder, no strips', (await page.locator('svg[data-shredder]').count()) === 0 && (await page.locator('span.absolute.block').count()) === 0)
  const moved = await startTimes(page, ['opt-cpt'], 300)
  check('the card never travels (it only fades)', moved['opt-cpt'] === undefined, JSON.stringify(moved))
  await page.getByRole('heading', { name: 'Tax forms deleted' }).waitFor({ timeout: 4000 })
  check('then the confirmation', (await serverItems(page)).length === 2)
  await context.close()
}

console.log('\nOPENING /deleted BY ITSELF\n')
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/deleted`, { waitUntil: 'load' })
  await page.waitForTimeout(500)
  check('says nothing about a deletion that didn’t happen: goes Home', new URL(page.url()).pathname === '/' && (await page.getByText(/deleted/i).count()) === 0)
  await context.close()
}

await browser.close()
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll delete audits passed.')
process.exit(failed ? 1 : 0)
