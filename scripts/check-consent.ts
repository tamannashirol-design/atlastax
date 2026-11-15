// Checks the consent decisions (src/consent/logic.ts), the browser store
// (src/consent/client.ts, against a pretend server) and that the notice's words
// and version move together (src/consent.config.ts).
// Run: npm run check:consent
import { createHash } from 'node:crypto'
import { CONSENT_COPY, CONSENT_COPY_FINGERPRINT, CONSENT_VERSION } from '../src/consent.config.ts'
import { consentLoaded, consentRefused, giveConsent, loadConsent } from '../src/consent/client.ts'
import { afterAgree, afterRefusal, consentNeeded, consentPending, fromServer, INITIAL_CONSENT, uploadsBlocked } from '../src/consent/logic.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}

console.log('THE NOTICE\n')
const fingerprint = createHash('sha256').update(JSON.stringify(CONSENT_COPY)).digest('hex').slice(0, 12)
check(`the words match the version (fingerprint ${fingerprint}); if this fails, bump CONSENT_VERSION and update CONSENT_COPY_FINGERPRINT`, fingerprint, CONSENT_COPY_FINGERPRINT)
check('the version isn’t empty', CONSENT_VERSION.length > 0, true)
check('it makes no promises about speed, accuracy or savings', /\b(fast|instant|guarantee|always|never|free|refund|save)\b/i.test(JSON.stringify(CONSENT_COPY)), false)
check('it says people check every detail', CONSENT_COPY.rows.some((r) => /check every detail/.test(r.text)), true)
check('it says how to delete', CONSENT_COPY.rows.some((r) => /remove any document/i.test(r.text)), true)

console.log('\nDECISIONS\n')
const ready = (o: object) => fromServer(o)
check('before we know: pending, uploads wait, no sheet yet', [consentPending(INITIAL_CONSENT), uploadsBlocked(INITIAL_CONSENT), consentNeeded(INITIAL_CONSENT)], [true, true, false])
check('required and not given: the sheet is needed, uploads wait', [consentNeeded(ready({ required: true, given: false })), uploadsBlocked(ready({ required: true, given: false }))], [true, true])
check('given: nothing to ask, uploads go', [consentNeeded(ready({ required: true, given: true })), uploadsBlocked(ready({ required: true, given: true }))], [false, false])
check('not required by the server: nothing to ask', [consentNeeded(ready({ required: false, given: false })), uploadsBlocked(ready({ required: false, given: false }))], [false, false])
check('a missing "required" is treated as required (safe)', consentNeeded(ready({ given: false })), true)
check('a missing "given" is treated as not given (safe)', ready({ required: true }).given, false)
check('server unreachable: uploads are not held (they fail on their own and say so)', uploadsBlocked({ ...INITIAL_CONSENT, status: 'error' }), false)
check('agreeing records the time', afterAgree(ready({ required: true, given: false, version: 'v1' }), '2025-01-01T00:00:00.000Z').at, '2025-01-01T00:00:00.000Z')
check('a refusal from the server asks again, and forgets the old time', consentNeeded(afterRefusal(afterAgree(ready({ required: true, version: 'v1' }), 'x'))), true)
check('a time is kept only when consent was given', ready({ required: true, given: false, at: 'x' }).at, undefined)

console.log('\nTHE BROWSER STORE (pretend server)\n')
type Fake = { given: boolean; version: string; required: boolean; at?: string; failPost?: boolean; posts: string[] }
const server: Fake = { given: false, version: 'v1', required: true, posts: [] }
globalThis.fetch = (async (input: string, init?: { method?: string; body?: string }) => {
  if (String(input) === '/api/consent' && init?.method === 'POST') {
    if (server.failPost) return { ok: false, status: 500, json: async () => ({}) }
    const v = (JSON.parse(init.body ?? '{}') as { version?: string }).version
    server.posts.push(v ?? '')
    if (v !== server.version) return { ok: false, status: 400, json: async () => ({}) }
    server.given = true
    server.at = '2025-06-01T00:00:00.000Z'
    return { ok: true, status: 204, json: async () => ({}) }
  }
  return { ok: true, status: 200, json: async () => ({ given: server.given, version: server.version, required: server.required, ...(server.given ? { at: server.at } : {}) }) }
}) as unknown as typeof fetch

await loadConsent(true)
check('loads the server’s answer: needed', [consentLoaded().status, consentNeeded(consentLoaded())], ['ready', true])
server.failPost = true
check('agreeing fails when the server can’t save it: still needed', [await giveConsent(), consentNeeded(consentLoaded())], [false, true])
server.failPost = false
check('agreeing sends the version the person saw', [await giveConsent(), server.posts.at(-1)], [true, 'v1'])
check('…and the sheet is no longer needed', consentNeeded(consentLoaded()), false)
consentRefused()
check('the server refusing an upload makes it needed again', consentNeeded(consentLoaded()), true)
server.version = 'v2'
server.given = false
await loadConsent(true)
check('a new notice version: needed again, with the new version', [consentNeeded(consentLoaded()), consentLoaded().version], [true, 'v2'])
check('agreeing then sends the NEW version', [await giveConsent(), server.posts.at(-1)], [true, 'v2'])
globalThis.fetch = (async () => {
  throw new Error('offline')
}) as unknown as typeof fetch
await loadConsent(true)
check('offline: status "error", uploads not held', [consentLoaded().status, uploadsBlocked(consentLoaded())], ['error', false])

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
