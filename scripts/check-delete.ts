// Checks "Delete my documents": the files are really gone from the disk, and the server refuses to return them afterwards.
// A real HTTP server on a spare port with a throwaway data folder; only made-up bytes. Run: npm run check:delete
//   OFFICIAL  (none: this is our own rule, not an IRS rule)
//   MINE      what each choice deletes and keeps (src/flow/deletion.ts)
import { createServer } from 'node:http'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app.ts'
import { DOCUMENT_RULES } from '../src/documents.config.ts'
import { isTaxFormItem, TAX_FORM_ITEM_IDS } from '../src/flow/deletion.ts'
import { answersAfterForms } from '../src/flow/deletionAnswers.ts'
import type { Answers } from '../src/flow/answers.ts'

const dataDir = await mkdtemp(join(tmpdir(), 'atlastax-delete-'))
const app = createApp({ dataDir, consentRequired: false, consentVersion: 'test-1', dev: true })
const server = createServer((req, res) => app(req, res))
await new Promise<void>((r) => server.listen(0, r))
const base = `http://localhost:${(server.address() as { port: number }).port}`

let failed = 0
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  (${detail})`}`)
  if (!pass) failed++
}
const PDF = () => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200)])
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]
const onDisk = async () => new Set(await readdir(join(dataDir, 'files')).catch(() => [] as string[]))
const hasAnyFile = async (id: string) => {
  const d = await onDisk()
  return d.has(id) || d.has(`${id}.json`)
}

type Session = { cookie: string; ids: Record<string, string> }
async function person(items: string[]): Promise<Session> {
  const s: Session = { cookie: cookieOf(await fetch(`${base}/api/consent`)), ids: {} }
  for (const item of items) {
    const r = await fetch(`${base}/api/files?kbps=100000`, { method: 'POST', body: PDF(), headers: { cookie: s.cookie, 'x-file-name': 'fake.pdf', ...(item === '(none)' ? {} : { 'x-item-id': item }), 'x-tax-year': '2025' } })
    s.ids[item] = ((await r.json()) as { fileId: string }).fileId
  }
  await fetch(`${base}/api/extraction/scenario`, { method: 'POST', headers: { cookie: s.cookie }, body: JSON.stringify({ scenario: 'fast' }) })
  await fetch(`${base}/api/extraction/start?year=2025`, { method: 'POST', headers: { cookie: s.cookie } })
  for (let i = 0; i < 60; i++) {
    const snap = (await (await fetch(`${base}/api/extraction?year=2025`, { headers: { cookie: s.cookie } })).json()) as { documents: { status: string }[] }
    if (snap.documents.length && snap.documents.every((d) => d.status === 'ready' || d.status === 'failed')) break
    await new Promise((r) => setTimeout(r, 50))
  }
  // a typed-in review for the W-2 (kept in memory on the server)
  await fetch(`${base}/api/review/opt-cpt?year=2025`, { method: 'PUT', headers: { cookie: s.cookie }, body: JSON.stringify({ manual: true }) })
  return s
}
const del = (s: Session, query: string, headers: Record<string, string> = {}) => fetch(`${base}/api/data?${query}`, { method: 'DELETE', headers: { cookie: s.cookie, ...headers } })
const reviewItems = async (s: Session) => ((await (await fetch(`${base}/api/review?year=2025`, { headers: { cookie: s.cookie } })).json()) as { documents: { itemId: string }[] }).documents.map((d) => d.itemId)
const readingItems = async (s: Session) => ((await (await fetch(`${base}/api/extraction?year=2025`, { headers: { cookie: s.cookie } })).json()) as { documents: { itemId: string }[] }).documents.map((d) => d.itemId)

console.log('MINE: what each choice covers (src/flow/deletion.ts)\n')
check('tax forms: W-2, 1042-S and the 1099 / brokerage ones', ['opt-cpt', 'on-campus-job', 'scholarship', 'freelance', 'contract-work', 'bank-interest', 'investments', 'trading'].every(isTaxFormItem), '')
check('the list of tax-form items equals the document rules (documents.config.ts)', JSON.stringify([...TAX_FORM_ITEM_IDS].sort()) === JSON.stringify(DOCUMENT_RULES.map((r) => r.id).sort()))
check('identity documents and the previous return are not tax forms', ['passport', 'i94', 'state-id', 'previous-return', 'cbp-history', undefined].every((i) => !isTaxFormItem(i)))
const mine: Answers = { visa: 'F-1', income: ['opt-cpt'], details: { 'opt-w2': ['W-2.pdf'], 'scholarship-1042s': ['1042-S.pdf'], 'passport-upload': ['Passport.pdf'], 'i94-upload': ['I-94.pdf'], 'state-id-upload': ['ID.pdf'] }, fileIds: { 'opt-w2': ['a'], 'passport-upload': ['b'] }, residency: { schoolFiles: ['I-20.pdf'] }, reviewAt: 'opt-cpt' }
const after = answersAfterForms(mine)
check('forms only (browser): the W-2 and 1042-S file names and ids are gone', !('opt-w2' in (after.details ?? {})) && !('scholarship-1042s' in (after.details ?? {})) && !('opt-w2' in (after.fileIds ?? {})))
check('forms only (browser): passport, I-94, ID, I-20 or DS-2019 and the visa answer stay', JSON.stringify([after.details?.['passport-upload'], after.details?.['i94-upload'], after.details?.['state-id-upload'], after.residency?.schoolFiles, after.visa, after.fileIds?.['passport-upload']]) === JSON.stringify([['Passport.pdf'], ['I-94.pdf'], ['ID.pdf'], ['I-20.pdf'], 'F-1', ['b']]))
check('forms only (browser): the resume point inside a deleted form is dropped', after.reviewAt === undefined)

console.log('\nDELETE TAX FORMS ONLY (on the server)\n')
const a = await person(['opt-cpt', 'scholarship', 'passport', 'i94', '(none)'])
const b = await person(['opt-cpt', 'passport']) // another person: must never be touched
check('before: all five of this person’s files are on the disk', (await Promise.all(Object.values(a.ids).map(hasAnyFile))).every(Boolean))
check('before: the typed-in W-2 review exists and the W-2 is listed', (await reviewItems(a)).includes('opt-cpt'))
const bad = await del(a, 'scope=nope')
check('an unknown scope is refused (400)', bad.status === 400)
const cross = await del(a, 'scope=forms', { origin: 'https://example.org' })
check('a request from another website is refused (403)', cross.status === 403)
const failing = await del(a, 'scope=forms&fail=1')
check('a failing server (dev switch) answers 500, never "deleted"…', failing.status === 500)
check('…and deletes nothing', (await Promise.all(Object.values(a.ids).map(hasAnyFile))).every(Boolean))
const r1 = await del(a, 'scope=forms')
const j1 = (await r1.json()) as { scope: string; deleted: number }
check('tax forms only: 200, and says how many (the W-2 and the 1042-S)', r1.status === 200 && j1.scope === 'forms' && j1.deleted === 2, JSON.stringify(j1))
check('the W-2 and the 1042-S are gone from the DISK (file and record)', !(await hasAnyFile(a.ids['opt-cpt'])) && !(await hasAnyFile(a.ids.scholarship)))
check('the passport, the I-94 and the file with no item stay on the disk', (await hasAnyFile(a.ids.passport)) && (await hasAnyFile(a.ids.i94)) && (await hasAnyFile(a.ids['(none)'])))
check('the server won’t delete or return a deleted file any more (404)', (await fetch(`${base}/api/files/${a.ids['opt-cpt']}`, { method: 'DELETE', headers: { cookie: a.cookie } })).status === 404)
const rv = await reviewItems(a)
check('Review no longer lists the W-2 or the 1042-S, but still the passport', !rv.includes('opt-cpt') && !rv.includes('scholarship') && rv.includes('passport'), rv.join())
check('what was read from them is gone too (no reading for the W-2 or 1042-S)', !(await readingItems(a)).some((i) => i === 'opt-cpt' || i === 'scholarship'))
check('saving or revealing a value of the deleted W-2 is refused (404)', (await fetch(`${base}/api/review/opt-cpt?year=2025`, { method: 'PUT', headers: { cookie: a.cookie }, body: JSON.stringify({ manual: true }) })).status === 404 && (await fetch(`${base}/api/review/opt-cpt/reveal?year=2025&key=employeeSsn`, { headers: { cookie: a.cookie } })).status === 404)
check('the other person’s files are all still there', (await hasAnyFile(b.ids['opt-cpt'])) && (await hasAnyFile(b.ids.passport)) && (await reviewItems(b)).includes('opt-cpt'))
const again = await del(a, 'scope=forms')
check('doing it again is fine (200, nothing left to delete)', again.status === 200 && ((await again.json()) as { deleted: number }).deleted === 0)

console.log('\nDELETE EVERYTHING (on the server)\n')
const r2 = await del(a, 'scope=everything')
const j2 = (await r2.json()) as { deleted: number }
check('everything: 200, and says how many (passport, I-94 and the file with no item)', r2.status === 200 && j2.deleted === 3, JSON.stringify(j2))
check('every one of this person’s files is gone from the DISK', (await Promise.all(Object.values(a.ids).map(hasAnyFile))).every((x) => !x))
check('Review and reading list nothing for them', (await reviewItems(a)).length === 0 && (await readingItems(a)).length === 0)
check('no file of theirs can be deleted or returned any more (404 for each)', (await Promise.all(Object.values(a.ids).map((id) => fetch(`${base}/api/files/${id}`, { method: 'DELETE', headers: { cookie: a.cookie } })))).every((r) => r.status === 404))
check('the other person is still untouched', (await hasAnyFile(b.ids['opt-cpt'])) && (await reviewItems(b)).includes('opt-cpt'))
const strangerTry = await del({ cookie: '', ids: {} }, 'scope=everything')
check('a stranger (no cookie) deletes only their own empty session: 200, and the other person’s files stay', strangerTry.status === 200 && (await hasAnyFile(b.ids.passport)))
const cookieB = await del(b, 'scope=everything')
check('the other person can delete theirs too', cookieB.status === 200 && !(await hasAnyFile(b.ids['opt-cpt'])) && !(await hasAnyFile(b.ids.passport)))
check('nothing is left in the files folder', [...(await onDisk())].filter((f) => !f.startsWith('.')).length === 0, [...(await onDisk())].join())

console.log('\nOUTSIDE DEVELOPMENT\n')
const prod = createApp({ dataDir, dev: false, consentRequired: false })
const ps = createServer((req, res) => prod(req, res))
await new Promise<void>((r) => ps.listen(0, r))
const pb = `http://localhost:${(ps.address() as { port: number }).port}`
check('the dev “fail” switch is rejected (400), not silently ignored', (await fetch(`${pb}/api/data?scope=forms&fail=1`, { method: 'DELETE' })).status === 400)
ps.close()

server.close()
await rm(dataDir, { recursive: true, force: true })
console.log(failed ? `\n${failed} failed` : '\nAll delete checks passed.')
process.exit(failed ? 1 : 0)
