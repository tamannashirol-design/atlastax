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

/** Agree to the current privacy notice for this browser, so upload tests start past the consent sheet
 *  (the consent sheet has its own section below). */
const agree = (page) =>
  page.evaluate(async () => {
    const c = await (await fetch('/api/consent')).json()
    await fetch('/api/consent', { method: 'POST', body: JSON.stringify({ version: c.notice.version, fingerprint: c.notice.fingerprint }) })
  })

/** Every file the browser actually sent (POST /api/files), by name, with the server's answer */
function watchUploads(page) {
  const sent = []
  page.on('requestfinished', async (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/files')) sent.push({ name: decodeURIComponent(r.headers()['x-file-name'] ?? ''), status: (await r.response())?.status() })
  })
  return sent
}

/** Drop a file on an element, like dragging it from the desktop */
async function dropFile(page, selector, name) {
  const dt = await page.evaluateHandle((n) => {
    const d = new DataTransfer()
    d.items.add(new File(['%PDF-1.4 ' + 'x'.repeat(4000)], n, { type: 'application/pdf' }))
    return d
  }, name)
  await page.locator(selector).dispatchEvent('dragenter', { dataTransfer: dt })
  await page.locator(selector).dispatchEvent('drop', { dataTransfer: dt })
}

/** A check that isn't about focus. */
function assert(where, step, ok, detail = '') {
  checks++
  if (!ok) failures.push(`${where} · ${step}: ${detail}`)
  console.log(`  ${ok ? '✓' : '✗'} ${step}${ok ? '' : '  ✗ ' + detail}`)
}

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
  await page.route('**/api/files*', (r) => r.abort())
  await pick(page, pdf('W2-retry.pdf'))
  await settle(page)
  await check(page, where, 'network error', { focus: /W2-retry\.pdf.*try again/i })
  await page.unroute('**/api/files*')
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
  await agree(page)
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
  await agree(page)
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

// The intro replayed from Profile (logged in; a dialog)
if (!only || 'intro replay'.includes(only)) {
  const where = 'intro replay'
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE + '/profile?auth=in', { waitUntil: 'networkidle' })
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
  // Get started goes to Home (never straight into the questions); its headline takes focus
  await check(page, where, 'Get started → Home', { focus: /^Let’s start your return$/, ring: false })
  // Earlier years: a sheet that traps and returns focus
  await tabTo(page, /^Filing for an earlier year\?$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'earlier years sheet', { focus: /^Close$/ })
  await page.keyboard.press('Escape')
  await settle(page)
  await check(page, where, 'sheet closed → its link', { focus: /^Filing for an earlier year\?$/ })
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
  // The header's fake sign-in badge (testing only) comes first; then the steps
  await tabTo(page, /^Answer a few simple questions/)
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
  await agree(page)
  await page.evaluate(() =>
    sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: { income: ['opt-cpt', 'freelance'], details: { 'freelance-form': 'no' } } } })),
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  console.log(where)
  await tabTo(page, /^Add W-2$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'upload sheet opened', { focus: /Close/ })
  await page.keyboard.press('Escape')
  await settle(page)
  await check(page, where, 'sheet closed → its card', { focus: /^W\u2060?-\u2060?2/ })
  await page.close()
}

// The consent sheet: the first upload, by keyboard (a fresh browser has not agreed yet)
if (!only || 'consent sheet'.includes(only)) {
  const where = 'consent sheet'
  const seed = () => sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: { income: ['opt-cpt'], details: {} } } }))
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(BASE + '/documents', { waitUntil: 'networkidle' })
    await page.evaluate(seed)
    await page.reload({ waitUntil: 'networkidle' })
    await page.evaluate(watchBody)
    await tabTo(page, /^Add W-2$/)
    await page.keyboard.press('Enter')
    await settle(page)
    return page
  }
  const consentOpen = (page) => page.getByRole('dialog', { name: 'Before you add a document' }).isVisible()
  // Reading starts only on request: asking it to start lists every document that has a file
  const uploadedCount = (page) => page.evaluate(async () => (await (await fetch('/api/extraction/start?year=2025', { method: 'POST' })).json()).documents.length)
  console.log(where)

  // Agree
  let page = await open()
  await check(page, where, 'first upload → consent sheet', { focus: /Close/ })
  assert(where, 'it is the consent sheet', await consentOpen(page))
  assert(where, 'nothing uploaded while it is open', (await uploadedCount(page)) === 0)
  await tabTo(page, /Read the full privacy notice/)
  await check(page, where, 'Tab → full notice link', { focus: /Read the full privacy notice/ })
  await tabTo(page, /^Continue to upload$/)
  await check(page, where, 'Tab → Continue to upload', { focus: /^Continue to upload$/ })
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'agreed → Choose a file', { focus: /^Choose a file$/ })
  assert(where, 'the server recorded the agreement', await page.evaluate(async () => (await (await fetch('/api/consent')).json()).given === true))
  await pick(page, pdf('W2-consent.pdf'))
  await waitRow(page, 'W2-consent.pdf')
  await settle(page)
  await check(page, where, 'upload after agreeing', { focus: /^W2-consent\.pdf, uploaded$/ })
  await page.close()

  // Not now: nothing uploaded, both sheets close, focus returns to the card
  page = await open()
  await tabTo(page, /^Not now$/)
  await check(page, where, 'Tab → Not now', { focus: /^Not now$/ })
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'Not now → the card', { focus: /^W\u2060?-\u2060?2/ })
  assert(where, 'both sheets are closed', (await page.locator('dialog[open]').count()) === 0)
  assert(where, 'nothing was uploaded', (await uploadedCount(page)) === 0)

  // Asked again next time; Escape means Not now
  await tabTo(page, /^Add W-2$/)
  await page.keyboard.press('Enter')
  await settle(page)
  assert(where, 'asked again the next time', await consentOpen(page))
  await page.keyboard.press('Escape')
  await settle(page)
  await check(page, where, 'Escape → the card', { focus: /^W\u2060?-\u2060?2/ })
  assert(where, 'Escape also closed both sheets', (await page.locator('dialog[open]').count()) === 0)
  await page.close()

  // FIX 1: the notice changes while the sheet is open (the server is faked for this part)
  page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE + '/documents', { waitUntil: 'networkidle' })
  const real = await page.evaluate(async () => (await (await fetch('/api/consent')).json()).notice)
  const oldNotice = real
  const newNotice = { version: 'audit-new', fingerprint: 'auditnew0000', copy: { ...real.copy, lead: 'NEW WORDS: the notice changed while you were reading.' } }
  const posted = []
  await page.route('**/api/consent', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { given: false, required: true, version: oldNotice.version, notice: oldNotice } })
    const shown = route.request().postDataJSON()
    posted.push(shown.version)
    if (shown.version === newNotice.version && shown.fingerprint === newNotice.fingerprint) return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 409, json: { error: 'notice-changed', notice: newNotice } })
  })
  await page.evaluate(seed)
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  await tabTo(page, /^Add W-2$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await tabTo(page, /^Continue to upload$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'notice changed → the note', { focus: /^The notice has changed/ })
  assert(where, 'the NEW words are on screen', (await page.getByText('NEW WORDS: the notice changed while you were reading.').count()) === 1)
  assert(where, 'the sheet stays open (nothing agreed)', await consentOpen(page))
  assert(where, 'it sent the version that was on screen (the old one)', posted.join() === oldNotice.version, posted.join())
  await tabTo(page, /^Continue to upload$/)
  await page.keyboard.press('Enter')
  await settle(page)
  await check(page, where, 'agreed to new words → zone', { focus: /^Choose a file$/ })
  assert(where, 'the second agreement sent the NEW version', posted.join() === `${oldNotice.version},${newNotice.version}`, posted.join())
  await page.close()

  // FIX 2: the agreement status can't be loaded: everything is held, nothing is sent
  page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  let sent = watchUploads(page)
  await page.route('**/api/consent', (route) => route.abort())
  await page.goto(BASE + '/documents', { waitUntil: 'networkidle' })
  await page.evaluate(seed)
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  await dropFile(page, '#item-opt-cpt', 'held.pdf')
  await settle(page)
  await check(page, where, 'status unavailable → message', { focus: /^We couldn’t check your privacy settings\.$/ })
  assert(where, 'no upload zone while it can’t check', (await page.getByRole('button', { name: 'Choose a file' }).count()) === 0)
  await page.waitForTimeout(1500)
  assert(where, 'the dropped file was NOT sent', sent.length === 0, JSON.stringify(sent))
  await page.unroute('**/api/consent')
  await tabTo(page, /^Try again$/)
  await page.keyboard.press('Enter')
  await settle(page)
  assert(where, 'Try again → the consent sheet', await consentOpen(page))
  assert(where, 'still nothing sent before agreeing', sent.length === 0, JSON.stringify(sent))
  await tabTo(page, /^Continue to upload$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  assert(where, 'after agreeing, the held file is sent once', sent.map((x) => x.name).join() === 'held.pdf', JSON.stringify(sent))
  await page.close()

  // FIX 4: a dropped file is sent once, even when agreement is asked a second time
  page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  sent = watchUploads(page)
  await page.goto(BASE + '/documents', { waitUntil: 'networkidle' })
  await page.evaluate(seed)
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(watchBody)
  await dropFile(page, '#item-opt-cpt', 'dropped.pdf')
  await settle(page)
  await page.getByRole('button', { name: 'Continue to upload' }).click()
  await waitRow(page, 'dropped.pdf')
  await settle(page)
  await page.context().clearCookies() // the server forgets this browser: the next upload is refused
  await tabTo(page, /^Add another file$/)
  await pick(page, pdf('second.pdf'))
  await settle(page)
  assert(where, 'refused → asked again', await consentOpen(page))
  await tabTo(page, /^Continue to upload$/)
  await page.keyboard.press('Enter')
  await waitRow(page, 'second.pdf')
  await settle(page)
  const names = sent.map((x) => `${x.name}:${x.status}`).join(', ')
  assert(where, 'dropped.pdf was sent exactly once', sent.filter((x) => x.name === 'dropped.pdf').length === 1, names)
  assert(where, 'second.pdf: refused once, then sent after agreeing', names.endsWith('second.pdf:403, second.pdf:201'), names)
  await page.close()
}

// The Reading page (/reading), by keyboard, against the mock reader
if (!only || 'reading'.includes(only)) {
  const where = 'reading page'
  const ready = { visa: 'F-1', enrolled: 'yes', state: 'CA', citizenship: 'FR', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'no' }, taxId: 'ssn', filedBefore: 'no', income: ['opt-cpt'], details: { 'opt-type': 'opt', 'opt-w2': ['W-2.pdf'], 'passport-upload': ['Passport.pdf'], 'i94-upload': ['I-94.pdf'] } }
  /** A return with passport, I-94 and W-2 added, and their (fake) files on the server */
  const setup = async (options = {}) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ...options })
    await page.goto(BASE + '/documents', { waitUntil: 'load' })
    await page.waitForTimeout(800) // the app settles the session cookie first
    await page.evaluate(async (a) => {
      sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: a } }))
      const c = await (await fetch('/api/consent')).json()
      await fetch('/api/consent', { method: 'POST', body: JSON.stringify({ version: c.notice.version, fingerprint: c.notice.fingerprint }) })
      for (const item of ['passport', 'i94', 'opt-cpt']) await fetch('/api/files', { method: 'POST', body: new Blob(['%PDF-1.4 sample']), headers: { 'x-item-id': item, 'x-tax-year': '2025', 'x-file-name': `${item}.pdf` } })
    }, ready)
    return page
  }
  console.log(where)

  const label = (page) => page.locator('[data-stage]').innerText()
  const liveSaid = (page, text) =>
    page.waitForFunction((t) => [...document.querySelectorAll('[aria-live]')].some((n) => n.textContent === t), text, { timeout: 12000 }).then(
      () => true,
      () => false,
    )

  // The three stages, in order, from real events; then Done → Review by itself
  let page = await setup()
  await page.goto(BASE + '/reading?reading=normal', { waitUntil: 'load' })
  await page.evaluate(watchBody)
  await page.waitForTimeout(600)
  await check(page, where, 'load → the headline', { focus: /^Your documents$/, ring: false })
  assert(where, 'stage 1: "Reading your documents"', /Reading your documents/.test(await label(page)))
  assert(where, 'the loops run while reading', (await page.locator('.loop-scan').count()) > 0 && (await page.locator('.loop-sweep').count()) === 1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  assert(where, 'loops pause when the tab is hidden', (await page.locator('[data-stage]').getAttribute('data-loops')) === 'paused')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  assert(where, '…and run again when it’s back', (await page.locator('[data-stage]').getAttribute('data-loops')) === 'running')
  assert(where, 'stage 2: "Extracting your details" (announced)', await liveSaid(page, 'Extracting your details'))
  await page.waitForTimeout(500) // the label cross-fade
  assert(where, '…and on the pill', /Extracting your details/.test(await label(page)))
  assert(where, 'stage 3: "Done" (announced)', await liveSaid(page, 'Done'))
  const doneAt = Date.now()
  assert(where, 'Done sits on the success fill', (await page.locator('[data-stage="done"]').count()) === 1)
  await page.waitForURL('**/review', { timeout: 5000 })
  const held = Date.now() - doneAt
  assert(where, 'Done settles and holds ~600ms, then Review by itself', held >= 600 && held < 3000, `${held}ms`)
  await page.close()

  // Reduced motion: no loops, the same three labels
  page = await setup({ reducedMotion: 'reduce' })
  await page.goto(BASE + '/reading?reading=normal', { waitUntil: 'load' })
  await page.waitForTimeout(600)
  assert(where, 'reduced motion: same label', /Reading your documents/.test(await label(page)))
  assert(where, 'reduced motion: no loops', (await page.locator('.loop-scan').count()) === 0 && (await page.locator('.loop-sweep').count()) === 0)
  assert(where, 'reduced motion: still reaches "Extracting your details"', await liveSaid(page, 'Extracting your details'))
  await page.close()

  // A failure: focus stays, it's announced; Try again → the headline; then everything is read → Review
  page = await setup()
  await page.goto(BASE + '/reading?reading=fail', { waitUntil: 'load' })
  await page.evaluate(watchBody)
  await page.getByText('Couldn’t read', { exact: true }).waitFor({ timeout: 12000 })
  await settle(page)
  // Several changes are spoken one after another (about 1.2s apart): wait for the failure's turn
  await page.waitForFunction(() => [...document.querySelectorAll('[aria-live]')].some((n) => n.textContent.startsWith('Couldn’t read your')), null, { timeout: 8000 })
  await check(page, where, 'a failure → focus stays', { focus: /^Your documents$/, ring: false, live: /^Couldn’t read your / })
  await page.getByRole('button', { name: 'Continue' }).waitFor({ timeout: 12000 })
  await page.waitForTimeout(500) // the label cross-fade
  assert(where, 'everything else read: the pill stops and Continue waits for the person', /Couldn’t read 1 document/.test(await label(page)) && new URL(page.url()).pathname === '/reading')
  await tabTo(page, /^Try again for /)
  await check(page, where, 'Tab → Try again', { focus: /^Try again for / })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  await check(page, where, 'Try again → the headline (the row goes away while it’s read again)', { focus: /^Your documents$/, ring: false })
  await page.waitForURL('**/review', { timeout: 20000 })
  assert(where, 'everything read → on to Review by itself', new URL(page.url()).pathname === '/review')
  await page.close()

  // Already read before: the page still shows and reads again (no skipping)
  page = await setup()
  await page.goto(BASE + '/reading', { waitUntil: 'load' })
  await page.waitForURL('**/review', { timeout: 20000 })
  await page.goto(BASE + '/reading', { waitUntil: 'load' })
  await page.waitForTimeout(800)
  assert(where, 'already read → the page shows again, from "Reading your documents"', new URL(page.url()).pathname === '/reading' && /Reading your documents/.test(await label(page)))
  await page.close()
}

// Review (/review), by keyboard, after a real reading (mock reader)
if (!only || 'review'.includes(only)) {
  const where = 'review'
  console.log(where)
  const ready = { visa: 'F-1', enrolled: 'yes', state: 'CA', citizenship: 'FR', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'no' }, taxId: 'ssn', filedBefore: 'no', income: ['opt-cpt'], details: { 'opt-type': 'opt', 'opt-w2': ['W-2.pdf'], 'passport-upload': ['Passport.pdf'], 'i94-upload': ['I-94.pdf'] } }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE + '/documents', { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await page.evaluate(async (a) => {
    sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: a } }))
    const c = await (await fetch('/api/consent')).json()
    await fetch('/api/consent', { method: 'POST', body: JSON.stringify({ version: c.notice.version, fingerprint: c.notice.fingerprint }) })
    for (const item of ['passport', 'i94', 'opt-cpt']) await fetch('/api/files', { method: 'POST', body: new Blob(['%PDF-1.4 sample']), headers: { 'x-item-id': item, 'x-tax-year': '2025', 'x-file-name': `${item}.pdf` } })
  }, ready)
  await page.goto(BASE + '/reading?reading=normal', { waitUntil: 'load' })
  await page.waitForURL('**/review', { timeout: 30000 })
  // Watch focus from the moment Review has loaded (it loads the details from the server first)
  await page.getByRole('heading', { name: 'Check your passport' }).waitFor()
  await page.waitForTimeout(300)
  await page.evaluate(watchBody)
  await check(page, where, 'arrive → the headline', { focus: /^Check your passport$/, ring: false })
  const confirm = page.getByRole('button', { name: 'Confirm and continue' })
  assert(where, 'Confirm is locked and says what’s left', (await confirm.isDisabled()) && (await page.getByText(/^\d+ details? to check/).count()) === 1)
  assert(where, 'the passport number is masked', (await page.getByText('•••••4567').count()) === 1)
  await tabTo(page, /^Show Passport number$/)
  await check(page, where, 'Tab → Show', { focus: /^Show Passport number$/ })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  assert(where, 'Show → focus in the field, full value, announced', (await page.evaluate(() => document.activeElement?.value)) === 'X1234567' && (await page.locator('[aria-live]').filter({ hasText: 'Passport number shown' }).count()) >= 1)
  for (const box of await page.getByRole('checkbox', { name: /^This is correct/ }).all()) {
    await box.focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(400)
  assert(where, 'every tick by keyboard → Confirm unlocks', !(await confirm.isDisabled()))
  assert(where, '…and it’s announced', (await page.locator('[aria-live]').filter({ hasText: 'Everything is checked. You can confirm.' }).count()) >= 1)
  await confirm.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  await check(page, where, 'Confirm → next document’s headline', { focus: /^Check your most recent I.?-.?94$/, ring: false })
  assert(where, '"2 of 3"', (await page.getByText(/^Document\s*2 of 3$/).count()) === 1)

  // Editing clears the tick
  const first = page.getByRole('checkbox', { name: /^This is correct.*Admission number/ })
  await first.focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  await page.getByLabel('Admission number', { exact: true }).focus()
  await page.keyboard.type('9')
  await page.waitForTimeout(1000)
  assert(where, 'editing a value clears its tick', !(await first.isChecked()))

  await tabTo(page, /^Skip this document for now$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  await check(page, where, 'Skip → W-2 headline', { focus: /^Check your W.?-.?2$/, ring: false })
  await tabTo(page, /^Skip this document for now$/, 80)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  await check(page, where, 'Skip the last → summary headline', { focus: /^Your details$/, ring: false })
  assert(where, 'summary: confirmed + skipped', (await page.getByText('Confirmed', { exact: true }).count()) === 1 && (await page.getByText('Skipped for now', { exact: true }).count()) === 2)
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(1000)
  assert(where, 'reload → resumes on the same screen', (await page.getByRole('heading', { name: 'Your details' }).count()) === 1)
  await tabTo(page, /^Looks good$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  assert(where, 'Looks good → /result', new URL(page.url()).pathname === '/result')
  await page.close()
}

// Time in the U.S.: trips out of the U.S., by keyboard
if (!only || 'trips'.includes(only)) {
  const where = 'trips'
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE + '/trips', { waitUntil: 'load' })
  await page.evaluate(() => sessionStorage.setItem('atlastax:returns', JSON.stringify({ year: 2025, years: { 2025: { visa: 'F-1', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'yes', trips: [] } } } })))
  await page.reload({ waitUntil: 'load' })
  await page.evaluate(watchBody)
  console.log(where)
  await tabTo(page, /^Add a trip$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await check(page, where, 'Add a trip → its first date', { focus: /^$/ })
  await page.keyboard.type('06012025')
  await page.waitForTimeout(300)
  await tabTo(page, /^Yes, I’m still away$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await check(page, where, 'still away → its row', { focus: /^Left on/ })
  await tabTo(page, /^Undo$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await check(page, where, 'Undo → its row', { focus: /^Left on/ })
  await tabTo(page, /^Delete trip 1$/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await check(page, where, 'delete the only trip → Add a trip', { focus: /^Add a trip$/ })
  await page.close()
}

await browser.close()
console.log(`\n${checks} checks, ${failures.length} failed`)
if (failures.length) {
  console.log(failures.map((f) => '✗ ' + f).join('\n'))
  process.exit(1)
}
