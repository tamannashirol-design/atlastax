// Checks the API's safety rules (server/app.ts) against a real HTTP server on
// a spare port, with a throwaway data folder. Only made-up bytes are uploaded.
// Run: npm run check:server
import { createServer } from 'node:http'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app.ts'

const dataDir = await mkdtemp(join(tmpdir(), 'atlastax-check-'))
const app = createApp({ dataDir, maxFileBytes: 1024, consentVersion: 'test-1', dev: true })
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

const strict = createApp({ dataDir, consentRequired: true, consentVersion: 'test-1', dev: true })
const strictServer = createServer((req, res) => strict(req, res))
await new Promise<void>((r) => strictServer.listen(0, r))
const strictBase = `http://localhost:${(strictServer.address() as { port: number }).port}`
const noConsent = await fetch(strictBase + '/api/files', { method: 'POST', body: PDF() })
check('with consent required, an upload without consent is refused (403)', noConsent.status === 403)
const withConsent = await fetch(strictBase + '/api/files?kbps=100000', { method: 'POST', body: PDF(), headers: { cookie } })
check('…and accepted once consent is recorded', withConsent.status === 201)

server.close()
strictServer.close()
await rm(dataDir, { recursive: true, force: true })
console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
