// Checks requiredItems(): the one function that turns income answers into
// documents and self-reported income items (rules: src/documents.config.ts).
// Prints the rules table from the config, then the cases.
// Run: npm run check:documents
import { DOCUMENT_RULES } from '../src/documents.config.ts'
import type { Answers } from '../src/flow/answers.ts'
import { documentsLine, incomeItemsLine, requiredItems, summarizeItems } from '../src/flow/requiredDocuments.ts'

// ---- the table, straight from the config ----
const rows = DOCUMENT_RULES.map((r) => [
  r.incomeLabel,
  r.form,
  r.formQuestion ? `asks "${r.formQuestion}"` : 'always',
  r.reportableWithoutForm ? 'yes' : 'no',
  r.formQuestion ? (r.reportableWithoutForm ? 'self-reported item, "Details needed"' : 'still a document (form expected)') : '—',
])
const head = ['Income', 'Document', 'Form question', 'reportableWithoutForm', 'If "No, I didn\'t get one"']
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
const line = (cells: string[]) => '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |'
console.log('Rules (src/documents.config.ts, TODO confirm with CPA)\n')
console.log(line(head))
console.log('|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|')
rows.forEach((r) => console.log(line(r)))
console.log('')

// ---- cases ----
let failed = 0
type Expect = { items: string[]; documents?: string; incomeLine?: string | null; done?: boolean }

function check(name: string, a: Answers, e: Expect) {
  const items = requiredItems(a)
  const s = summarizeItems(items)
  const got = items.map((i) => `${i.id}:${i.kind}:${i.status}`)
  const problems: string[] = []
  if (got.join() !== e.items.join()) problems.push(`items [${got.join(', ')}] ≠ [${e.items.join(', ')}]`)
  if (e.documents !== undefined && documentsLine(s) !== e.documents) problems.push(`"${documentsLine(s)}" ≠ "${e.documents}"`)
  if (e.incomeLine !== undefined && incomeItemsLine(s) !== e.incomeLine) problems.push(`"${incomeItemsLine(s)}" ≠ "${e.incomeLine}"`)
  if (e.done !== undefined && s.done !== e.done) problems.push(`done ${s.done} ≠ ${e.done}`)
  console.log(`${problems.length ? '✗' : '✓'} ${name}`)
  console.log(`    items: ${got.length ? got.join(', ') : '(none)'}`)
  console.log(`    "${documentsLine(s)}"${incomeItemsLine(s) ? ` · "${incomeItemsLine(s)}"` : ''} · Documents step done: ${s.done}`)
  if (problems.length) {
    console.log('    ✗ ' + problems.join('\n    ✗ '))
    failed++
  }
}

check('1. Nothing answered', {}, { items: [], documents: 'No documents needed yet', incomeLine: null, done: true })
check('2. No earnings', { income: ['no-earnings'] }, { items: [], documents: 'No documents needed yet', done: true })
check('3. OPT/CPT + scholarship, nothing uploaded', { income: ['opt-cpt', 'scholarship'] }, {
  items: ['opt-cpt:document:missing', 'scholarship:document:missing'],
  documents: '0 of 2 documents added',
  done: false,
})
check('4. One added, one "I\'ll add it later", one "I didn\'t get one"', {
  income: ['opt-cpt', 'on-campus-job', 'scholarship'],
  details: { 'opt-w2': ['w2.pdf'], 'campus-w2': 'later', 'scholarship-1042s': 'none' },
}, {
  items: ['opt-cpt:document:added', 'on-campus-job:document:later', 'scholarship:document:none'],
  documents: '1 of 3 documents added',
  incomeLine: null,
  done: true,
})
check('5. Freelance, "Yes, I got one" (1099-NEC uploaded)', { income: ['freelance'], details: { 'freelance-form': 'yes', 'freelance-1099': ['nec.pdf'] } }, {
  items: ['freelance:document:added'],
  documents: '1 of 1 document added',
  done: true,
})
check('6. Freelance, form question not answered yet', { income: ['freelance'] }, {
  items: ['freelance:document:missing'],
  documents: '0 of 1 document added',
  done: false,
})
check('7. Bank interest, "Yes, I got one" (1099-INT not uploaded yet)', { income: ['bank-interest'], details: { 'bank-form': 'yes' } }, {
  items: ['bank-interest:document:missing'],
  documents: '0 of 1 document added',
  done: false,
})

console.log('\nNew cases')
check('8. Freelance, "No, I didn\'t get one"', { income: ['freelance'], details: { 'freelance-form': 'no' } }, {
  items: ['freelance:income:details-needed'],
  documents: 'No documents needed yet',
  incomeLine: '1 income item needs details',
  done: false,
})
check('9. Bank interest, "No, I didn\'t get one"', { income: ['bank-interest'], details: { 'bank-form': 'no' } }, {
  items: ['bank-interest:income:details-needed'],
  documents: 'No documents needed yet',
  incomeLine: '1 income item needs details',
  done: false,
})
check('10. Mixed: 2 of 3 documents + freelance with no form', {
  income: ['opt-cpt', 'on-campus-job', 'scholarship', 'freelance'],
  details: { 'opt-w2': ['a.pdf'], 'campus-w2': ['b.pdf'], 'freelance-form': 'no' },
}, {
  items: ['opt-cpt:document:added', 'on-campus-job:document:added', 'scholarship:document:missing', 'freelance:income:details-needed'],
  documents: '2 of 3 documents added',
  incomeLine: '1 income item needs details',
  done: false,
})
check('11. Self-reported item deferred with "I\'ll add it later" → step done', {
  income: ['bank-interest'],
  details: { 'bank-form': 'no', 'self-report:bank-interest': 'later' },
}, { items: ['bank-interest:income:later'], incomeLine: null, done: true })
check('12. Contract work, "No" (reportableWithoutForm = false)', { income: ['contract-work'], details: { 'contract-form': 'no' } }, {
  items: ['contract-work:document:missing'],
  documents: '0 of 1 document added',
  done: false,
})

console.log('\n"Or" documents (one item, either form counts)')
check('13. Investments, 1099-DIV uploaded', { income: ['investments'], details: { 'investments-upload': ['1099-DIV Example Brokerage.pdf'] } }, {
  items: ['investments:document:added'],
  documents: '1 of 1 document added',
  done: true,
})
check('14. Trading, neither form uploaded', { income: ['trading'] }, {
  items: ['trading:document:missing'],
  documents: '0 of 1 document added',
  done: false,
})

// ---- finishing without a form: every type, both paths (rules unchanged) ----
console.log('\nFinishing without a form (each type on its own)\n')
const pathHead = ['Item', '"I don\'t have this"', '"I\'ll add it later"']
const pathRows: string[][] = []
for (const r of DOCUMENT_RULES) {
  const base: Answers = { income: [r.income], details: r.formQuestion ? { [r.formQuestion]: 'yes' } : {} }
  const say = (v: string) => {
    const s = summarizeItems(requiredItems({ ...base, details: { ...base.details, [r.uploadScreen]: v } }))
    return `${documentsLine(s)} · done ${s.done}`
  }
  pathRows.push([`${r.form} (${r.incomeLabel})`, say('none'), say('later')])
}
for (const r of DOCUMENT_RULES.filter((x) => x.reportableWithoutForm)) {
  const base: Answers = { income: [r.income], details: { [r.formQuestion!]: 'no' } }
  const s0 = summarizeItems(requiredItems(base))
  const s1 = summarizeItems(requiredItems({ ...base, details: { ...base.details, [`self-report:${r.id}`]: 'later' } }))
  pathRows.push([`${r.incomeLabel}, no form (self-reported)`, `n/a (they told us about it) · now: ${incomeItemsLine(s0)} · done ${s0.done}`, `${incomeItemsLine(s1) ?? 'no items need details'} · done ${s1.done}`])
}
const pw = pathHead.map((h, i) => Math.max(h.length, ...pathRows.map((r) => r[i].length)))
const pline = (c: string[]) => '| ' + c.map((x, i) => x.padEnd(pw[i])).join(' | ') + ' |'
console.log(pline(pathHead))
console.log('|' + pw.map((w) => '-'.repeat(w + 2)).join('|') + '|')
pathRows.forEach((r) => console.log(pline(r)))

console.log(failed ? `\n${failed} failed` : '\nAll checks pass.')
process.exit(failed ? 1 : 0)
