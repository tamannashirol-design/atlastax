// Keyboard-only focus audit for every upload (the 8 income upload screens and
// the previous-return sheet), the logged-out intro page and the intro replay. Uses only Tab, Enter,
// Escape and arrow keys: no mouse.
//
// After every state change (upload started, done, removed, failed, retried,
// confirm opened/kept) it checks that focus:
//   1. is not on the page body (also watched on every animation frame, so a
//      brief drop to the body in between steps fails too),
//   2. is on the element we expect, and
//   3. shows a visible focus ring (:focus-visible + a real outline).
//
// Run with the dev server up (it serves the test upload endpoint):
//   npm run dev        (in one terminal)
//   npm run audit:focus
//   ONLY=sheet npm run audit:focus     (or ONLY=opt-w2: run just the matching part)
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const SCREENS = [
  '/income/bank-upload',
  '/income/opt-w2',
  '/income/campus-w2',
  '/income/scholarship-1042s',
  '/income/freelance-1099',
  '/income/investments-upload',
  '/income/trading-upload',
  '/income/contract-1099',
]

try {
  await fetch(BASE)
} catch {
  console.error(`Can't reach ${BASE}. Start the app with "npm run dev" first.`)
  process.exit(1)
}

const browser = await chromium.launch({ channel: 'chrome' })
const failures = []
let checks = 0

const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ' + 'x'.repeat(4000)) })
const txt = (name) => ({ name, mimeType: 'text/plain', buffer: Buffer.from('not a tax form') })

/** Watch every frame for focus falling back to the body. Counting starts once
 *  something has had focus (right after a page load, nothing is focused yet). */
const watchBody = () => {
  window.__bodyDrops = 0
  let started = false
  const tick = () => {
    const onBody = !document.activeElement || document.activeElement === document.body
    if (!onBody) started = true
    else if (started) window.__bodyDrops++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function describe() {
  const el = document.activeElement
  const cs = el ? getComputedStyle(el) : null
  return {
    body: !el || el === document.body,
    text: (el?.getAttribute('aria-label') || el?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    tag: el?.tagName.toLowerCase(),
    ring: !!el && el.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
    live: [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent.trim()).filter(Boolean),
    drops: window.__bodyDrops,
  }
}

async function check(page, where, step, expect) {
  checks++
  const f = await page.evaluate(describe)
  await page.evaluate(() => (window.__bodyDrops = 0))
  const problems = []
  if (f.body) problems.push('focus is on the body')
  if (f.drops) problems.push(`focus fell to the body for ${f.drops} frame(s) during this step`)
  if (!f.ring && expect.ring !== false) problems.push(`no visible focus ring on <${f.tag}> "${f.text}"`)
  if (expect.focus && !expect.focus.test(f.text)) problems.push(`expected focus on ${expect.focus}, got <${f.tag}> "${f.text}"`)
  if (expect.live && !f.live.some((t) => expect.live.test(t))) problems.push(`expected live region ${expect.live}, got [${f.live.join(' | ')}]`)
  const ok = problems.length === 0
  if (!ok) failures.push(`${where} · ${step}: ${problems.join('; ')}`)
  console.log(`  ${ok ? '✓' : '✗'} ${step.padEnd(28)} → <${f.tag}> "${f.text.slice(0, 50)}"${ok ? '' : '  ✗ ' + problems.join('; ')}`)
}

/** Press Tab until the focused element's text matches, like a keyboard user would. */
async function tabTo(page, re, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const t = await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim())
    if (re.test(t)) return
  }
  throw new Error(`Couldn't reach ${re} with Tab`)
}

/** Enter on the focused button opens the file picker; choose a file.
 *  Automated Chrome now and then ignores a picker request when many open in a
 *  row, so press Enter again (focus must still be on the button), and log it. */
async function pick(page, file) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const chooser = page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null)
    await page.keyboard.press('Enter')
    const c = await chooser
    if (c) return c.setFiles(file)
    console.log(`    (picker didn't open, pressing Enter again on "${await page.evaluate(() => document.activeElement?.textContent.trim())}")`)
  }
  throw new Error('File picker never opened')
}

const waitRow = (page, name) =>
  page.waitForFunction((n) => [...document.querySelectorAll('[data-file-row]')].some((r) => r.textContent.includes(n)), name, { timeout: 15000 })
const settle = (page) => page.waitForTimeout(700) // longest spring is 400ms

async function uploadFlow(page, where) {
  // Upload
  await tabTo(page, /^Choose a file$/)
  await pick(page, pdf('W2-acme.pdf'))
  await page.waitForTimeout(50)
  await check(page, where, 'upload started', { focus: /W2-acme\.pdf/ })
  await waitRow(page, 'W2-acme.pdf')
  await settle(page)
  await check(page, where, 'upload done', { focus: /^W2-acme\.pdf, uploaded$/, live: /^W2-acme\.pdf uploaded$/ })

  // Remove → Keep file
  await tabTo(page, /^Remove W2-acme\.pdf$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'confirm opened', { focus: /Close|Remove file|Keep file/ })
  await tabTo(page, /^Keep file$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'kept file', { focus: /^Remove W2-acme\.pdf$/ })

  // Remove → Escape
  await page.keyboard.press('Enter')
  await settle(page)
  await page.keyboard.press('Escape')
  await settle(page)
  await check(page, where, 'confirm escaped', { focus: /^Remove W2-acme\.pdf$/ })

  // Remove → Remove file
  await page.keyboard.press('Enter')
  await settle(page)
  await tabTo(page, /^Remove file$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'file removed', { focus: /^Choose a file$/, live: /^W2-acme\.pdf removed$/ })

  // Wrong file type → error message
  await pick(page, txt('notes.txt'))
  await settle(page)
  await check(page, where, 'unsupported file (error)', { focus: /isn’t supported/ })

  // A wrong file type can't be retried, so the error offers "Choose another file".
  // Pick a real file, but the network fails → error message, then Try again → done
  await tabTo(page, /^Choose another file$/)
  await page.route('**/api/upload*', (r) => r.abort())
  await pick(page, pdf('W2-retry.pdf'))
  await settle(page)
  await check(page, where, 'network error', { focus: /W2-retry\.pdf.*try again/i })
  await page.unroute('**/api/upload*')
  await tabTo(page, /^Try again$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(50)
  await check(page, where, 'retry started', { focus: /W2-retry\.pdf/ })
  await waitRow(page, 'W2-retry.pdf')
  await settle(page)
  await check(page, where, 'retry done', { focus: /^W2-retry\.pdf, uploaded$/, live: /^W2-retry\.pdf uploaded$/ })
}

const only = process.env.ONLY
for (const path of SCREENS.filter((p) => !only || p.includes(only))) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.evaluate(() => sessionStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  console.log(path)
  await uploadFlow(page, path)
  if (errors.length) failures.push(`${path}: JS errors ${errors.join(' | ')}`)
  await page.close()
}

// The previous-return sheet: reach it by keyboard from "Filed before"
if (!only || 'previous-return sheet'.includes(only)) {
  const where = 'previous-return sheet'
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 } })
  await page.goto(BASE + '/filed-before', { waitUntil: 'networkidle' })
  await page.evaluate(() => sessionStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  console.log(where)
  await tabTo(page, /^Yes$/)
  await page.keyboard.press('Space')
  await tabTo(page, /^Continue$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'sheet opened', {})
  await uploadFlow(page, where)
  await page.close()
}

// The intro replayed from Help on Home (logged in; a dialog)
if (!only || 'intro replay'.includes(only)) {
  const where = 'intro replay'
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE + '/?auth=in', { waitUntil: 'networkidle' })
  await page.evaluate(() => sessionStorage.clear())
  await page.evaluate(watchBody)
  console.log(where)
  await tabTo(page, /^Replay intro$/)
  await page.keyboard.press('Enter')
  await settle(page)
  // On open, the intro's root has focus (no ring by design; the dialog's label and description are read)
  await check(page, where, 'opened', { ring: false })
  await page.keyboard.press('ArrowRight')
  await settle(page)
  await check(page, where, '→ scene 2', { ring: false, live: /^Step 2 of 3: Add your documents$/ })
  await tabTo(page, /^Next$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'Next → scene 3', { focus: /^Get started$/, live: /^Step 3 of 3/ })
  await page.keyboard.press('ArrowLeft')
  await settle(page)
  await check(page, where, '← back to scene 2', { focus: /^Next$/, live: /^Step 2 of 3/ })
  await page.keyboard.press('Escape')
  await settle(page)
  await check(page, where, 'Escape → Replay intro', { focus: /^Replay intro$/ })
  await page.keyboard.press('Enter')
  await settle(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await settle(page)
  await tabTo(page, /^Get started$/)
  await page.keyboard.press('Enter')
  await settle(page)
  // The question heading takes focus (headings have no ring by design)
  await check(page, where, 'Get started → first question', { focus: /^What is your visa type\?$/, ring: false })
  await page.close()
}

// The logged-out page, phone composition
if (!only || 'landing'.includes(only)) {
  const where = 'logged-out page (phone)'
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE + '/?auth=out', { waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  console.log(where)
  await tabTo(page, /^Get started$/)
  await check(page, where, 'Tab → Get started', { focus: /^Get started$/ })
  await page.keyboard.press('ArrowRight')
  await settle(page)
  await check(page, where, '→ scene 2 (focus stays)', { focus: /^Get started$/, live: /^Step 2 of 3/ })
  await page.keyboard.press('Tab')
  await check(page, where, 'Tab → Log in', { focus: /^Log in$/ })
  await page.keyboard.press('Tab')
  await check(page, where, 'Tab → Privacy', { focus: /^Privacy$/ })
  await page.close()
}

// The logged-out page, wide composition: steps as a tablist + preview
if (!only || 'landing wide'.includes(only)) {
  const where = 'logged-out page (wide)'
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(BASE + '/?auth=out', { waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  console.log(where)
  await page.keyboard.press('Tab')
  await check(page, where, 'Tab → selected step', { focus: /^Answer a few simple questions/ })
  await page.keyboard.press('ArrowDown')
  await settle(page)
  await check(page, where, '↓ next step', { focus: /^Add your documents/, live: /^Step 2 of 3: Add your documents$/ })
  await page.keyboard.press('End')
  await settle(page)
  await check(page, where, 'End → last step', { focus: /^Get your forms, ready to file/, live: /^Step 3 of 3/ })
  await page.keyboard.press('Tab')
  await check(page, where, 'Tab → demo panel', { focus: /Preview of a finished Form/ })
  await page.keyboard.press('Tab')
  await check(page, where, 'Tab → Get started', { focus: /^Get started$/ })
  await page.keyboard.press('Tab')
  await check(page, where, 'Tab → Log in', { focus: /^Log in$/ })
  await page.keyboard.press('Tab')
  await check(page, where, 'Tab → Privacy', { focus: /^Privacy$/ })
  await page.close()
}

// The Documents page: defer, undo and the upload sheet, by keyboard
if (!only || 'documents'.includes(only)) {
  const where = 'documents page'
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE + '/documents', { waitUntil: 'networkidle' })
  await page.evaluate(() =>
    sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2026, years: { 2026: { income: ['opt-cpt', 'freelance'], details: { 'freelance-form': 'no' } } } })),
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  console.log(where)
  await tabTo(page, /^I’ll add it later$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await check(page, where, 'defer W-2 → its row', { focus: /^W-2/, live: /W-2: you’ll add it later/ })
  await tabTo(page, /^Undo for W-2$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await check(page, where, 'Undo → its row', { focus: /^W-2/, live: /W-2: not added yet/ })
  await tabTo(page, /^Upload W-2$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'upload sheet opened', { focus: /Close/ })
  await page.keyboard.press('Escape')
  await settle(page)
  await check(page, where, 'sheet closed → its row', { focus: /^W-2/ })
  await page.close()
}

await browser.close()
console.log(`\n${checks} checks, ${failures.length} failed`)
if (failures.length) {
  console.log(failures.map((f) => '✗ ' + f).join('\n'))
  process.exit(1)
}
