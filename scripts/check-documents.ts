// Checks requiredDocuments(): the one function that turns income answers into
// required documents (rules: src/documents.config.ts). Run: npm run check:documents
import type { Answers } from '../src/flow/answers.ts'
import { requiredDocuments, summarizeDocuments } from '../src/flow/requiredDocuments.ts'

let failed = 0
function expect(name: string, a: Answers, ids: string[], summary?: Partial<ReturnType<typeof summarizeDocuments>>, statuses?: Record<string, string>) {
  const docs = requiredDocuments(a)
  const got = docs.map((d) => d.id)
  const s = summarizeDocuments(docs)
  const problems: string[] = []
  if (got.join() !== ids.join()) problems.push(`documents [${got}] ≠ [${ids}]`)
  for (const [k, v] of Object.entries(summary ?? {})) if ((s as Record<string, unknown>)[k] !== v) problems.push(`${k} ${(s as Record<string, unknown>)[k]} ≠ ${v}`)
  for (const [id, st] of Object.entries(statuses ?? {})) {
    const d = docs.find((x) => x.id === id)
    if (d?.status !== st) problems.push(`${id} status ${d?.status} ≠ ${st}`)
  }
  console.log(`${problems.length ? '✗' : '✓'} ${name}${problems.length ? '  ' + problems.join('; ') : ''}`)
  if (problems.length) failed++
}

expect('nothing answered', {}, [], { total: 0, done: true })
expect('no earnings', { income: ['no-earnings'] }, [], { total: 0 })
expect('OPT/CPT + scholarship', { income: ['opt-cpt', 'scholarship'] }, ['w2-opt-cpt', '1042s-scholarship'], { total: 2, missing: 2, done: false })
expect('freelance, 1099 question not answered yet', { income: ['freelance'] }, [], { total: 0 })
expect('freelance, got a 1099-NEC', { income: ['freelance'], details: { 'freelance-form': 'yes' } }, ['1099nec-freelance'])
expect('freelance, no 1099-NEC (amount instead)', { income: ['freelance'], details: { 'freelance-form': 'no' } }, [])
expect('bank interest needs "yes" first', { income: ['bank-interest'], details: { 'bank-form': 'no' } }, [])
expect(
  'one added, one later, one none',
  { income: ['opt-cpt', 'on-campus-job', 'scholarship'], details: { 'opt-w2': ['w2.pdf'], 'campus-w2': 'later', 'scholarship-1042s': 'none' } },
  ['w2-opt-cpt', 'w2-on-campus', '1042s-scholarship'],
  { total: 3, added: 1, deferred: 2, missing: 0, done: true },
  { 'w2-opt-cpt': 'added', 'w2-on-campus': 'later', '1042s-scholarship': 'none' },
)
expect('empty upload list is still missing', { income: ['trading'], details: { 'trading-upload': [] } }, ['brokerage-forms'], { missing: 1, done: false })
expect('all eight income documents', {
  income: ['bank-interest', 'opt-cpt', 'on-campus-job', 'scholarship', 'freelance', 'investments', 'trading', 'contract-work'],
  details: { 'bank-form': 'yes', 'freelance-form': 'yes', 'contract-form': 'yes' },
}, ['bank-interest-form', 'w2-opt-cpt', 'w2-on-campus', '1042s-scholarship', '1099nec-freelance', 'investment-forms', 'brokerage-forms', '1099nec-contract'], { total: 8 })

console.log(failed ? `\n${failed} failed` : '\nAll checks pass.')
process.exit(failed ? 1 : 0)
