// Checks the API's safety rules (server/app.ts) against a real HTTP server on
// a spare port, with a throwaway data folder. Only made-up bytes are uploaded.
// Run: npm run check:server
import { createServer } from 'node:http'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app.ts'

const dataDir = await mkdtemp(join(tmpdir(), 'atlastax-check-'))
// consentRequired is on by default; this main test server opts out so the upload and reading tests need no agreement step (consent has its own section)
const app = createApp({ dataDir, maxFileBytes: 1024, consentRequired: false, consentVersion: 'test-1', dev: true })
const server = createServer((req, res) => app(req, res))
await new Promise<void>((r) => server.listen(0, r))
const base = `http://localhost:${(server.address() as { port: number }).port}`

let failed = 0
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  (${detail})`}`)
  if (!pass) failed++
}

const PDF = () => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200)])
const PNG = () => Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(200)])

async function post(path: string, body: Buffer | string, headers: Record<string, string> = {}) {
  return fetch(base + path, { method: 'POST', body, headers: { 'x-file-name': encodeURIComponent('W-2 sample.pdf'), ...headers } })
}
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]
const filesOnDisk = async () => (await readdir(join(dataDir, 'files')).catch(() => [])).filter((f) => !f.endsWith('.json'))

console.log('UPLOADS\n')
const first = await post('/api/files?kbps=100000', PDF(), { 'x-item-id': 'opt-cpt' })
const cookie = cookieOf(first)
const body = (await first.json()) as { fileId: string; name: string; size: number }
check('a PDF is accepted (201) and gets an id', first.status === 201 && /^[0-9a-f-]{36}$/.test(body.fileId), `status ${first.status}`)
check('a new session cookie is HttpOnly and SameSite', /HttpOnly/.test(first.headers.get('set-cookie') ?? '') && /SameSite=Lax/.test(first.headers.get('set-cookie') ?? ''))
check('answers are never cached', first.headers.get('cache-control') === 'no-store')
check('the file is stored once', (await filesOnDisk()).length === 1)
const mode = (await stat(join(dataDir, 'files', body.fileId))).mode & 0o777
check('the stored file is private to this user (600)', mode === 0o600, mode.toString(8))

const png = await post('/api/files?kbps=100000', PNG(), { cookie })
check('a photo (PNG) is accepted', png.status === 201)

const renamed = await post('/api/files?kbps=100000', Buffer.from('just some text, named .pdf'), { cookie })
check('a text file named .pdf is refused (415): the server looks inside', renamed.status === 415)

const big = await post('/api/files?kbps=100000', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(4096)]), { cookie })
check('a file over the limit is refused (413)', big.status === 413)

const empty = await post('/api/files', Buffer.alloc(0), { cookie })
check('an empty file is refused', empty.status === 415)

const dry = await post('/api/files?dry=1&kbps=100000', PDF(), { cookie })
check('?dry=1 (the /motion page) is measured but not stored', dry.status === 201 && (await filesOnDisk()).length === 2)

const sneaky = await post('/api/files?kbps=100000', PDF(), { cookie, 'x-file-name': encodeURIComponent('../../etc/W-2.pdf') })
check('folders are stripped from file names', ((await sneaky.json()) as { name: string }).name === 'W-2.pdf')
check('refused and partial uploads leave nothing behind', !(await readdir(join(dataDir, 'files'))).some((f) => f.endsWith('.partial')))

const crossSite = await post('/api/files', PDF(), { cookie, origin: 'https://example.org' })
check('uploads from another website are refused (403)', crossSite.status === 403)

console.log('\nDELETING\n')
const other = await fetch(`${base}/api/files/${body.fileId}`, { method: 'DELETE' })
check('someone else can’t delete your file (404)', other.status === 404)
const badId = await fetch(`${base}/api/files/..%2F..%2Fpackage.json`, { method: 'DELETE', headers: { cookie } })
check('a made-up path can’t delete anything (404)', badId.status === 404)
const del = await fetch(`${base}/api/files/${body.fileId}`, { method: 'DELETE', headers: { cookie } })
check('you can delete your own file (204)', del.status === 204)
check('…and it’s gone from the disk', !(await filesOnDisk()).includes(body.fileId))

console.log('\nCONSENT\n')
const before = (await (await fetch(`${base}/api/consent`, { headers: { cookie } })).json()) as { given: boolean; version: string }
check('consent starts as not given', before.given === false && before.version === 'test-1')
const wrong = await fetch(`${base}/api/consent`, { method: 'POST', headers: { cookie }, body: JSON.stringify({ version: 'old' }) })
check('agreeing to an old notice version is refused (400)', wrong.status === 400)
await fetch(`${base}/api/consent`, { method: 'POST', headers: { cookie }, body: JSON.stringify({ version: 'test-1' }) })
const after = (await (await fetch(`${base}/api/consent`, { headers: { cookie } })).json()) as { given: boolean }
check('consent is recorded for this session', after.given === true)
const afterFull = (await (await fetch(`${base}/api/consent`, { headers: { cookie } })).json()) as { at?: string }
check('…with the time it was recorded', typeof afterFull.at === 'string' && !Number.isNaN(Date.parse(afterFull.at)))
const beforeFull = (await (await fetch(`${base}/api/consent`)).json()) as { at?: string }
check('…and no time is shown to someone who hasn’t agreed', beforeFull.at === undefined)

const strict = createApp({ dataDir, consentRequired: true, consentVersion: 'test-1', dev: true })
const strictServer = createServer((req, res) => strict(req, res))
await new Promise<void>((r) => strictServer.listen(0, r))
const strictBase = `http://localhost:${(strictServer.address() as { port: number }).port}`
const noConsent = await fetch(strictBase + '/api/files', { method: 'POST', body: PDF() })
check('with consent required, an upload without consent is refused (403)', noConsent.status === 403)
const withConsent = await fetch(strictBase + '/api/files?kbps=100000', { method: 'POST', body: PDF(), headers: { cookie } })
check('…and accepted once consent is recorded', withConsent.status === 201)

// A changed notice: the same person is asked again
const bumped = createApp({ dataDir, consentRequired: true, consentVersion: 'test-2', dev: true })
const bumpedServer = createServer((req, res) => bumped(req, res))
await new Promise<void>((r) => bumpedServer.listen(0, r))
const bumpedBase = `http://localhost:${(bumpedServer.address() as { port: number }).port}`
const bumpedGet = (await (await fetch(`${bumpedBase}/api/consent`, { headers: { cookie } })).json()) as { given: boolean; version: string }
check('a new notice version asks the same person again', bumpedGet.given === false && bumpedGet.version === 'test-2')
check('…and an upload is refused until they agree to it', (await fetch(bumpedBase + '/api/files?kbps=100000', { method: 'POST', body: PDF(), headers: { cookie } })).status === 403)
await fetch(`${bumpedBase}/api/consent`, { method: 'POST', headers: { cookie }, body: JSON.stringify({ version: 'test-2' }) })
check('…then accepted', (await fetch(bumpedBase + '/api/files?kbps=100000', { method: 'POST', body: PDF(), headers: { cookie } })).status === 201)

// Measured-only dev uploads (the /motion page, the style guide) store nothing, so they need no consent
const dryNoConsent = await fetch(strictBase + '/api/files?dry=1&kbps=100000', { method: 'POST', body: PDF() })
check('a measured-only (?dry=1) upload needs no consent', dryNoConsent.status === 201)
check('…but a real one in the same server still does', (await fetch(strictBase + '/api/files?kbps=100000', { method: 'POST', body: PDF() })).status === 403)

// The default is on
const defaults = createApp({ dataDir, dev: true })
const defaultsServer = createServer((req, res) => defaults(req, res))
await new Promise<void>((r) => defaultsServer.listen(0, r))
const defaultsBase = `http://localhost:${(defaultsServer.address() as { port: number }).port}`
check('consent is required by default', (await fetch(defaultsBase + '/api/files?kbps=100000', { method: 'POST', body: PDF() })).status === 403)
const defaultsGet = (await (await fetch(`${defaultsBase}/api/consent`)).json()) as { required: boolean }
check('…and the browser is told so', defaultsGet.required === true)
bumpedServer.close()
defaultsServer.close()

console.log('\nREADING (mock provider)\n')
type Snap = { capabilities: { stages: boolean }; documents: { itemId: string; status: string; failure?: string; files: number }[] }
const reader = { cookie: '' }
const snap = async (): Promise<Snap> => (await (await fetch(`${base}/api/extraction?year=2025`, { headers: reader })).json()) as Snap
const statusOf = async (itemId: string) => (await snap()).documents.find((d) => d.itemId === itemId)
async function until(itemId: string, want: string, ms = 4000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if ((await statusOf(itemId))?.status === want) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return false
}
const upload = (itemId: string) => post('/api/files?kbps=100000', PDF(), { ...reader, 'x-item-id': itemId, 'x-tax-year': '2025' })
const scenario = (name: string) => fetch(`${base}/api/extraction/scenario`, { method: 'POST', headers: reader, body: JSON.stringify({ scenario: name }) })

reader.cookie = cookieOf(await fetch(`${base}/api/consent`))
await scenario('fast')

// Listen to the live updates for the whole section, to check what reaches the browser
const events: string[] = []
const live = new AbortController()
const stream = fetch(`${base}/api/extraction/events?year=2025`, { headers: reader, signal: live.signal }).then(async (r) => {
  const dec = new TextDecoder()
  for await (const chunk of r.body!) events.push(dec.decode(chunk as Uint8Array))
}).catch(() => {})

const w2 = (await (await upload('opt-cpt')).json()) as { fileId: string }
check('an upload with a document and year starts reading right away', ['queued', 'reading', 'checking'].includes((await statusOf('opt-cpt'))?.status ?? ''))
check('…and reaches "ready"', await until('opt-cpt', 'ready'))
check('files without a readable document aren’t read (previous return)', (await upload('previous-return')).status === 201 && !(await statusOf('previous-return')))

await scenario('one-fails')
await upload('passport')
check('one-fails: the next upload fails', await until('passport', 'failed'))
check('…with a reason', (await statusOf('passport'))?.failure === 'unreadable')
const retried = await fetch(`${base}/api/extraction/passport/retry?year=2025`, { method: 'POST', headers: reader })
check('Try again restarts reading (204)', retried.status === 204)
check('…and this time it works', await until('passport', 'ready', 8000))

await scenario('fast')
await upload('opt-cpt')
check('adding a second file re-reads the document with both files', (await statusOf('opt-cpt'))?.files === 2 && (await until('opt-cpt', 'ready')))
await fetch(`${base}/api/files/${w2.fileId}`, { method: 'DELETE', headers: reader })
check('removing one file re-reads with the file that’s left', (await statusOf('opt-cpt'))?.files === 1 && (await until('opt-cpt', 'ready')))

const otherYear = (await (await fetch(`${base}/api/extraction?year=2024`, { headers: reader })).json()) as Snap
check('another tax year sees none of these documents', otherYear.documents.length === 0)
const stranger = (await (await fetch(`${base}/api/extraction?year=2025`)).json()) as Snap
check('another session sees none of these documents', stranger.documents.length === 0)
check('scenarios can’t be set outside development', (await createAppStatus()) === 404)

await new Promise((r) => setTimeout(r, 300))
live.abort()
await stream
const all = events.join('')
check('live updates arrived (snapshot, then document changes)', all.includes('"type":"snapshot"') && all.includes('"status":"checking"') && all.includes('"status":"ready"'))
check('no extracted value ever reaches the browser', !/123-45-6789|12-3456789|X1234567|24180|SAMPLE/.test(all + JSON.stringify(await snap())))

async function createAppStatus() {
  const prod = createApp({ dataDir, dev: false })
  const s = createServer((req, res) => prod(req, res))
  await new Promise<void>((r) => s.listen(0, r))
  const r = await fetch(`http://localhost:${(s.address() as { port: number }).port}/api/extraction/scenario`, { method: 'POST', body: JSON.stringify({ scenario: 'fast' }) })
  s.close()
  return r.status
}

server.close()
strictServer.close()
await rm(dataDir, { recursive: true, force: true })
console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
