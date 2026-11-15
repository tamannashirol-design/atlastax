// Checks the Reading page's decisions (src/reading/logic.ts) and Home's reading
// states (src/home/returnStatus.ts). Run: npm run check:reading
import type { DocumentReading, ExtractionState } from '../src/extraction/client.ts'
import type { RequiredItem } from '../src/flow/requiredDocuments.ts'
import { announcements, continueLabel, DONE_HOLD_MS, failureCopy, readingOverview, readingStage, stageLabel, STAGE_LABEL } from '../src/reading/logic.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}

// Documents as requiredItems() returns them (only the fields the page reads)
const doc = (id: string, form: string, opts: { optional?: boolean; label?: string; status?: string } = {}) =>
  ({ kind: 'document', id, form, label: opts.label ?? form, optional: opts.optional, status: opts.status ?? 'added', uploadScreen: `${id}-upload` }) as unknown as RequiredItem
const passport = doc('passport', 'Passport')
const i94 = doc('i94', 'Most recent I-94')
const w2 = doc('opt-cpt', 'W-2', { label: 'W-2 from your employer' })
const campus = doc('on-campus-job', 'W-2', { label: 'W-2 for your on-campus job' })
const stateId = doc('state-id', 'Driver’s license or state ID', { optional: true })
const items = [passport, i94, w2]
const ex = (docs: Record<string, Partial<DocumentReading> | undefined>, loaded = true): ExtractionState => ({
  loaded,
  capabilities: { stages: true },
  documents: Object.fromEntries(Object.entries(docs).filter(([, d]) => d).map(([id, d]) => [id, { itemId: id, files: 1, status: 'ready', ...d } as DocumentReading])),
})

console.log('OUTCOMES\n')
check('everything ready → "Done", then on to Review by itself', readingOverview(items, ex({ passport: {}, i94: {}, 'opt-cpt': {} })).outcome, 'all-ready')
check('one still being read → working', readingOverview(items, ex({ passport: {}, i94: { status: 'reading' }, 'opt-cpt': {} })).outcome, 'working')
check('one waiting its turn → working', readingOverview(items, ex({ passport: {}, i94: { status: 'queued' }, 'opt-cpt': {} })).outcome, 'working')
check('one failed, the rest ready → wait for Continue', readingOverview(items, ex({ passport: {}, i94: { status: 'failed', failure: 'blurry' }, 'opt-cpt': {} })).outcome, 'needs-continue')
check('a failure never blocks the others: still working while another is read', readingOverview(items, ex({ passport: { status: 'failed', failure: 'unreadable' }, i94: { status: 'reading' }, 'opt-cpt': {} })).outcome, 'working')
check('every required document failed → wait, "Enter them myself"', [readingOverview(items, ex({ passport: { status: 'failed' }, i94: { status: 'failed' }, 'opt-cpt': { status: 'failed' } })).outcome, continueLabel({ outcome: 'all-failed' })], ['all-failed', 'Enter them myself'])
check('nothing added → back to Documents', readingOverview([doc('passport', 'Passport', { status: 'later' })], ex({})).outcome, 'empty')
check('added, but the server has no file for it → "Couldn’t read" (missing)', readingOverview([passport], ex({})).rows[0], { id: 'passport', name: 'Passport', form: 'Passport', optional: false, status: 'failed', failure: 'missing' })
check('before the server answers, everything counts as waiting (nothing is decided as ready)', readingOverview(items, ex({}, false)).rows.map((r) => r.status).join(), 'queued,queued,queued')

console.log('\nOPTIONAL DOCUMENTS (read if added, never block)\n')
const withOptional = [...items, stateId]
check('an optional document is listed', readingOverview(withOptional, ex({ passport: {}, i94: {}, 'opt-cpt': {}, 'state-id': {} })).total, 4)
check('an optional document still being read does not hold the page', readingOverview(withOptional, ex({ passport: {}, i94: {}, 'opt-cpt': {}, 'state-id': { status: 'reading' } })).outcome, 'all-ready')
check('an optional document that failed does not stop the page moving on', readingOverview(withOptional, ex({ passport: {}, i94: {}, 'opt-cpt': {}, 'state-id': { status: 'failed' } })).outcome, 'all-ready')
check('…but its row still says it failed', readingOverview(withOptional, ex({ passport: {}, i94: {}, 'opt-cpt': {}, 'state-id': { status: 'failed' } })).rows[3].status, 'failed')
check('an optional document still running keeps the loops going (it is really being read)', readingOverview(withOptional, ex({ passport: {}, i94: {}, 'opt-cpt': {}, 'state-id': { status: 'reading' } })).running, true)

console.log('\nTHE THREE STAGES (from the server\u2019s statuses only)\n')
const stage = (docs: Record<string, Partial<DocumentReading>>, list = items) => readingStage(readingOverview(list, ex(docs)))
check('labels, in order', Object.values(STAGE_LABEL), ['Reading your documents', 'Extracting your details', 'Done'])
check('anything required still waiting → "Reading your documents"', stage({ passport: { status: 'queued' }, i94: { status: 'checking' }, 'opt-cpt': {} }), 'reading')
check('anything required still being read → "Reading your documents"', stage({ passport: { status: 'reading' }, i94: { status: 'checking' }, 'opt-cpt': {} }), 'reading')
check('nothing waiting or being read, something being checked → "Extracting your details"', stage({ passport: { status: 'checking' }, i94: { status: 'checking' }, 'opt-cpt': {} }), 'extracting')
check('every required document ready → "Done"', stage({ passport: {}, i94: {}, 'opt-cpt': {} }), 'done')
check('before the server answers → "Reading your documents"', readingStage(readingOverview(items, ex({}, false))), 'reading')
check('an optional document still being read doesn’t hold "Extracting"', stage({ passport: { status: 'checking' }, i94: {}, 'opt-cpt': {}, 'state-id': { status: 'reading' } }, [...items, stateId]), 'extracting')
check('a failure while others are read → keeps going', stage({ passport: { status: 'failed' }, i94: { status: 'reading' }, 'opt-cpt': {} }), 'reading')
check('every result in, one failed → stops (waits for the person)', stage({ passport: { status: 'failed' }, i94: {}, 'opt-cpt': {} }), 'failed')
check('…and says how many', stageLabel('failed', { failedRequired: 2 }), 'Couldn’t read 2 documents')
check('nothing to read → no stage', readingStage(readingOverview([doc('passport', 'Passport', { status: 'later' })], ex({}))), null)
check('after Done settles, hold 600ms before Review', DONE_HOLD_MS, 600)

console.log('\nWORDS\n')
check('two rows with the same form get their fuller labels', readingOverview([w2, campus], ex({ 'opt-cpt': {}, 'on-campus-job': {} })).rows.map((r) => r.name), ['W-2 from your employer', 'W-2 for your on-campus job'])
check('unreadable → "We couldn’t read this one." + Try again', failureCopy({ form: 'W-2', failure: 'unreadable' }), { message: 'We couldn’t read this one.', first: 'retry' })
check('wrong type names the expected form, offers another file', failureCopy({ form: '1042-S', failure: 'wrong-type' }), { message: 'This doesn’t look like a 1042-S.', first: 'replace' })
check('blurry → another file', failureCopy({ form: 'Passport', failure: 'blurry' }).first, 'replace')
check('sideways → another file', failureCopy({ form: 'Passport', failure: 'rotated' }).message, 'This photo is sideways or upside down. Try one that’s upright.')
check('missing file → add it again', failureCopy({ form: 'Passport', failure: 'missing' }), { message: 'We couldn’t find this file. Add it again.', first: 'replace' })

console.log('\nANNOUNCEMENTS (real changes only)\n')
const snap = (st: Record<string, Partial<DocumentReading>>) => {
  const o = readingOverview(items, ex(st))
  return { stage: readingStage(o), rows: o.rows }
}
const s0 = snap({ passport: { status: 'queued' }, i94: { status: 'queued' }, 'opt-cpt': { status: 'queued' } })
check('nothing on the first look', announcements(null, s0), [])
check('nothing when nothing changed (no loop ticks)', announcements(s0, s0), [])
check('nothing when a document moves on inside the same stage', announcements(s0, snap({ passport: { status: 'reading' }, i94: { status: 'queued' }, 'opt-cpt': { status: 'queued' } })), [])
check('each new stage, once, by its label', announcements(s0, snap({ passport: { status: 'checking' }, i94: { status: 'checking' }, 'opt-cpt': { status: 'checking' } })), ['Extracting your details'])
check('Done', announcements(snap({ passport: { status: 'checking' }, i94: {}, 'opt-cpt': {} }), snap({ passport: {}, i94: {}, 'opt-cpt': {} })), ['Done'])
check('a document that couldn’t be read', announcements(s0, snap({ passport: { status: 'queued' }, i94: { status: 'failed' }, 'opt-cpt': { status: 'queued' } })), ['Couldn’t read your most recent I-94'])
check('form codes stay as they are', announcements(s0, snap({ passport: { status: 'queued' }, i94: { status: 'queued' }, 'opt-cpt': { status: 'failed' } })), ['Couldn’t read your W-2'])

console.log('\nHOME (returnStatus uses homeReadingState)\n')
const { homeReadingState } = await import('../src/reading/logic.ts')
const home = (docs: Record<string, Partial<DocumentReading>>) => homeReadingState(readingOverview(items, ex(docs)))
check('documents done and everything read → Home unchanged ("ready")', home({ passport: {}, i94: {}, 'opt-cpt': {} }), null)
check('still being read (the page was left) → Home unchanged', home({ passport: { status: 'reading' }, i94: {}, 'opt-cpt': {} }), null)
check('one couldn’t be read → "1 document couldn’t be read" / See what happened', [home({ passport: { status: 'failed' }, i94: {}, 'opt-cpt': {} })?.headline, home({ passport: { status: 'failed' }, i94: {}, 'opt-cpt': {} })?.buttonLabel], ['1 document couldn’t be read', 'See what happened'])
check('an optional document that failed doesn’t change Home', homeReadingState(readingOverview(withOptional, ex({ passport: {}, i94: {}, 'opt-cpt': {}, 'state-id': { status: 'failed' } }))), null)
check('nothing read yet (no reading status), Home is unchanged', homeReadingState(null), null)

console.log('\nLOOP TOKENS vs the CSS (keyframe percentages are typed by hand)\n')
const { loop } = await import('../src/lib/motion.ts')
const { readFileSync } = await import('node:fs')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
check('scan: one step = 25% of the pass (4 steps)', [100 / loop.scan.steps, /@keyframes loop-scan-row[\s\S]*?25%/.test(css)], [25, true])
check('sweep: moving part = 70% of the cycle (1.4s of 2.0s)', [Math.round((loop.sweep.move / loop.sweep.duration) * 100), /@keyframes loop-sweep-band[\s\S]*?70%/.test(css)], [70, true])

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
