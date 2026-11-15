// Checks the consent notice registry (src/consent.config.ts), the consent decisions
// (src/consent/logic.ts) and the browser store (src/consent/client.ts) against a
// pretend server that verifies notices the way the real one does.
// Run: npm run check:consent
import { CONSENT_COPY, CONSENT_NOTICES, CONSENT_VERSION } from '../src/consent.config.ts'
import { consentLoaded, consentRefused, giveConsent, loadConsent } from '../src/consent/client.ts'
import {
  afterAgree,
  afterNoticeChanged,
  afterRefusal,
  consentCheckFailed,
  consentNeeded,
  consentPending,
  consentSheetOpen,
  fromServer,
  INITIAL_CONSENT,
  isNotice,
  uploadsBlocked,
  type Notice,
} from '../src/consent/logic.ts'
import { fingerprintOf } from '../server/notice.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}

console.log('THE NOTICE (src/consent.config.ts)\n')
const fp = fingerprintOf(CONSENT_COPY)
const current = CONSENT_NOTICES.at(-1)
check(
  `the newest registered notice is the current words (fingerprint ${fp}); if this fails: bump CONSENT_VERSION and ADD { version, fingerprint: '${fp}' } to CONSENT_NOTICES`,
  current,
  { version: CONSENT_VERSION, fingerprint: fp },
)
check('every registered version is different', new Set(CONSENT_NOTICES.map((n) => n.version)).size, CONSENT_NOTICES.length)
check('every registered fingerprint is different', new Set(CONSENT_NOTICES.map((n) => n.fingerprint)).size, CONSENT_NOTICES.length)
check('it makes no promises about speed, accuracy or savings', /\b(fast|instant|guarantee|always|never|free|refund|save)\b/i.test(JSON.stringify(CONSENT_COPY)), false)
check('it says people check every detail', CONSENT_COPY.rows.some((r) => /check every detail/.test(r.text)), true)
check('it says how to delete', CONSENT_COPY.rows.some((r) => /remove any document/i.test(r.text)), true)

console.log('\nDECISIONS (src/consent/logic.ts)\n')
const v1: Notice = { version: 'v1', fingerprint: fingerprintOf(CONSENT_COPY), copy: CONSENT_COPY }
const ready = (o: object) => fromServer({ notice: v1, ...o })
check('before we know: pending, uploads held, no sheet yet', [consentPending(INITIAL_CONSENT), uploadsBlocked(INITIAL_CONSENT), consentNeeded(INITIAL_CONSENT)], [true, true, false])
check('required and not given: sheet needed, uploads held', [consentNeeded(ready({ required: true, given: false })), uploadsBlocked(ready({ required: true, given: false }))], [true, true])
check('given: nothing to ask, uploads allowed', [consentNeeded(ready({ required: true, given: true })), uploadsBlocked(ready({ required: true, given: true }))], [false, false])
check('not required by the server: nothing to ask, uploads allowed', [consentNeeded(fromServer({ required: false })), uploadsBlocked(fromServer({ required: false }))], [false, false])
check('FIX 2: status can’t be loaded → uploads HELD and the check-failed message shows', [uploadsBlocked({ ...INITIAL_CONSENT, status: 'error' }), consentCheckFailed({ ...INITIAL_CONSENT, status: 'error' })], [true, true])
check('a required notice the server didn’t send (or sent broken) is an error: uploads held', [fromServer({ required: true, given: false }).status, uploadsBlocked(fromServer({ required: true, notice: { version: 'x' } }))], ['error', true])
check('a missing "required" is treated as required (safe)', consentNeeded(fromServer({ given: false, notice: v1 })), true)
check('a missing "given" is treated as not given (safe)', fromServer({ required: true, notice: v1 }).given, false)
check('the notice to show is the one the server sent', fromServer({ notice: v1 }).notice?.fingerprint, v1.fingerprint)
check('isNotice rejects a notice with missing words', isNotice({ version: 'v', fingerprint: 'f', copy: { title: 't' } }), false)
check('agreeing records the time and clears "changed"', afterAgree({ ...ready({ given: false }), changed: true }, '2025-01-01T00:00:00.000Z'), { ...ready({ given: false }), changed: false, given: true, at: '2025-01-01T00:00:00.000Z' })
const v2: Notice = { ...v1, version: 'v2', fingerprint: 'v2fingerprint', copy: { ...CONSENT_COPY, lead: 'New words.' } }
const changedState = afterNoticeChanged(ready({ given: false }), v2)
check('FIX 1: a newer notice replaces the shown words, says it changed, and is not given', [changedState.notice?.version, changedState.notice?.copy.lead, changedState.changed, changedState.given], ['v2', 'New words.', true, false])
check('a refusal from the server asks again, and forgets the old time', consentNeeded(afterRefusal(afterAgree(ready({}), 'x'))), true)
const needed = ready({ required: true, given: false })
check('the sheet opens for a storing upload that needs consent', consentSheetOpen(needed, { stores: true, declined: false }), true)
check('FIX 4: "Not now" closes the sheet even when nothing else closes it', consentSheetOpen(needed, { stores: true, declined: true }), false)
check('FIX 4: …also right after a server refusal (no sheet that can’t be dismissed)', consentSheetOpen(afterRefusal(needed), { stores: true, declined: true }), false)
check('measured-only uploads never open it', consentSheetOpen(needed, { stores: false, declined: false }), false)

console.log('\nTHE BROWSER STORE, against a pretend server that verifies notices\n')
// Like server/app.ts: records agreement only to the CURRENT notice; an older known one gets 409 + the current notice
const known: Notice[] = [v1]
const server = { notice: v1, given: false, failPost: false, posts: [] as { version: string; fingerprint: string }[], recorded: [] as string[] }
globalThis.fetch = (async (input: string, init?: { method?: string; body?: string }) => {
  if (String(input) === '/api/consent' && init?.method === 'POST') {
    if (server.failPost) return { ok: false, status: 500, json: async () => ({}) }
    const shown = JSON.parse(init.body ?? '{}') as { version: string; fingerprint: string }
    server.posts.push(shown)
    if (shown.version === server.notice.version && shown.fingerprint === server.notice.fingerprint) {
      server.given = true
      server.recorded.push(shown.version)
      return { ok: true, status: 204, json: async () => ({}) }
    }
    if (known.some((n) => n.version === shown.version && n.fingerprint === shown.fingerprint)) return { ok: false, status: 409, json: async () => ({ error: 'notice-changed', notice: server.notice }) }
    return { ok: false, status: 400, json: async () => ({ error: 'unknown-notice' }) }
  }
  return { ok: true, status: 200, text: async () => '', json: async () => ({ given: server.given, required: true, version: server.notice.version, notice: server.notice, ...(server.given ? { at: '2025-06-01T00:00:00.000Z' } : {}) }) }
}) as unknown as typeof fetch

await loadConsent(true)
check('loads the server’s answer and notice: needed, showing v1', [consentNeeded(consentLoaded()), consentLoaded().notice?.version], [true, 'v1'])
server.failPost = true
check('the server can’t save it: "failed", still needed, nothing recorded', [await giveConsent(), consentNeeded(consentLoaded()), server.recorded], ['failed', true, []])
server.failPost = false

console.log('\n  — the notice changes while the tab is open —')
// The tab is showing v1. Meanwhile the server moves to v2 (a deploy with new words).
known.push(v2)
server.notice = v2
check('pressing Continue sends the notice ON SCREEN (v1), not the server’s', [await giveConsent(), server.posts.at(-1)?.version], ['changed', 'v1'])
check('…nothing was recorded for v1', server.recorded, [])
check('…the new words now show, marked as changed, still not agreed', [consentLoaded().notice?.version, consentLoaded().notice?.copy.lead, consentLoaded().changed, consentLoaded().given], ['v2', 'New words.', true, false])
check('…pressing Continue again agrees to v2, the words now on screen', [await giveConsent(), server.posts.at(-1)?.version, server.recorded], ['agreed', 'v2', ['v2']])
check('…and the "changed" note goes away', consentLoaded().changed, false)

console.log('\n  — other cases —')
consentRefused()
check('the server refusing an upload makes it needed again', consentNeeded(consentLoaded()), true)
server.given = true
await loadConsent(true)
check('a garbled notice from the server: nothing is agreed', fromServer({ required: true, notice: { version: 'v3' } }).status, 'error')
globalThis.fetch = (async () => {
  throw new Error('offline')
}) as unknown as typeof fetch
await loadConsent(true)
check('FIX 2: offline → status "error", uploads HELD', [consentLoaded().status, uploadsBlocked(consentLoaded())], ['error', true])
check('offline: agreeing fails, nothing pretends to be recorded', [await giveConsent(), consentLoaded().given], ['failed', true])

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
