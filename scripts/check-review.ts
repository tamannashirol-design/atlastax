// Checks Review's rules (src/review/logic.ts): the tick rule, masking, "editing clears
// the tick", what's left, and the summary words. Run: npm run check:review
import { FIELDS } from '../src/extraction.config.ts'
import { applyPatch, canConfirm, EMPTY_REVIEW, fieldNeeds, leftLine, reviewView, summaryStatus, type SavedReview, type Suggestion } from '../src/review/logic.ts'

let failed = 0
function check(name: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`)
  if (!pass) failed++
}

const w2: Suggestion[] = [
  { key: 'employeeTaxId', suggested: '123-45-6789', confidence: 'high' },
  { key: 'employeeAddress', suggested: '123 Sample St Apt 4B, New York, NY 10001', confidence: 'high' },
  { key: 'employerName', suggested: 'Sample Employer Inc.', confidence: 'high' },
  { key: 'employerEin', suggested: '12-3456789', confidence: 'high' },
  { key: 'wages', suggested: '24180.00', confidence: 'high' },
  { key: 'federalWithheld', suggested: '2016.00', confidence: 'low' },
  { key: 'state', suggested: 'NY', confidence: 'low' },
  { key: 'stateWages', suggested: '24180.00', confidence: 'high' },
  { key: 'stateWithheld', suggested: null, confidence: 'missing' },
]
const view = (saved: SavedReview = EMPTY_REVIEW) => reviewView('opt-cpt', 'W-2', { status: 'ready' }, w2, saved)
const field = (key: string, saved?: SavedReview) => view(saved).fields!.find((f) => f.key === key)!
const current = (saved: SavedReview) => (k: string) => saved.fields[k]?.value ?? w2.find((s) => s.key === k)?.suggested ?? ''
const patch = (saved: SavedReview, p: Parameters<typeof applyPatch>[2]) => applyPatch(saved, 'W-2', p, current(saved))

console.log('TICK RULE\n')
check('money needs a tick even when the reader is sure', fieldNeeds(field('wages')), 'tick')
check('an ID number needs a tick even when the reader is sure', fieldNeeds(field('employeeTaxId')), 'tick')
check('a plain detail the reader is sure of needs nothing', fieldNeeds(field('employerName')), null)
check('a plain detail marked "Please check" needs a tick', fieldNeeds(field('state')), 'tick')
check('not found → must be typed', fieldNeeds(field('stateWithheld')), 'type')
check('…or "Not on my form" where allowed', fieldNeeds(field('stateWithheld', patch(EMPTY_REVIEW, { stateWithheld: { notOnForm: true } }))), null)
check('"Not on my form" is refused where the form must have it', field('wages', patch(EMPTY_REVIEW, { wages: { notOnForm: true } })).notOnForm, false)
check('every money / id / name / date field in the config needs a tick (config rule)', Object.values(FIELDS).flat().filter((f) => ['money', 'id', 'date'].includes(f.kind) && !f.needsTick).length, 0)

console.log('\nEDITING\n')
const ticked = patch(EMPTY_REVIEW, { wages: { ticked: true } })
check('ticking marks it correct', field('wages', ticked).ticked, true)
const edited = patch(ticked, { wages: { value: '24,000.00' } })
check('editing a value clears its tick', [field('wages', edited).ticked, field('wages', edited).edited, fieldNeeds(field('wages', edited))], [false, true, 'tick'])
check('"editing" to the same value changes nothing', field('wages', patch(ticked, { wages: { value: '24180.00' } })).ticked, true)
check('unknown fields and over-long values are ignored', [Object.keys(patch(EMPTY_REVIEW, { nope: { ticked: true } }).fields), field('wages', patch(EMPTY_REVIEW, { wages: { value: 'x'.repeat(101) } })).shown], [[], '24180.00'])
check('any change reopens a confirmed document', patch({ ...ticked, status: 'confirmed' }, { wages: { ticked: false } }).status, 'open')

console.log('\nMASKING (ID numbers leave the server masked)\n')
check('SSN', [field('employeeTaxId').shown, field('employeeTaxId').spoken], ['•••-••-6789', 'SSN ending in 6 7 8 9'])
check('EIN', field('employerEin').shown, '••-•••6789')
check('no full ID number anywhere in what the screen gets', JSON.stringify(view()).includes('123-45-6789') || JSON.stringify(view()).includes('12-3456789'), false)
check('a typed ID number is masked too', field('employeeTaxId', patch(EMPTY_REVIEW, { employeeTaxId: { value: '555-55-5555' } })).shown, '•••-••-5555')

console.log('\nWHAT’S LEFT, CONFIRMING\n')
check('says what’s left', leftLine(view().fields!), '7 details to check and 1 to type')
const done = patch(EMPTY_REVIEW, Object.fromEntries([...['employeeTaxId', 'employeeAddress', 'employerEin', 'wages', 'federalWithheld', 'state', 'stateWages'].map((k) => [k, { ticked: true }]), ['stateWithheld', { notOnForm: true }]]))
check('everything done → can confirm, nothing left', [canConfirm(view(done).fields), leftLine(view(done).fields!)], [true, null])
check('one detail left → can’t confirm', canConfirm(view(patch(done, { wages: { ticked: false } })).fields), false)

console.log('\nSTATES\n')
check('being read → no fields yet', reviewView('opt-cpt', 'W-2', { status: 'reading' }, null, EMPTY_REVIEW).fields, null)
check('couldn’t read → no fields, "Couldn’t read"', summaryStatus(reviewView('opt-cpt', 'W-2', { status: 'failed', failure: 'unreadable' }, null, EMPTY_REVIEW)), 'couldnt-read')
check('wrong document', summaryStatus(reviewView('opt-cpt', 'W-2', { status: 'failed', failure: 'wrong-type' }, null, EMPTY_REVIEW)), 'wrong-type')
const manual = reviewView('opt-cpt', 'W-2', { status: 'failed', failure: 'unreadable' }, null, { ...EMPTY_REVIEW, manual: true })
check('"Enter it myself" → every field empty, to type', [manual.fields!.every((f) => !f.hasValue), manual.fields!.every((f) => f.confidence === 'missing')], [true, true])
check('"Enter it myself" never shows a suggestion', reviewView('opt-cpt', 'W-2', { status: 'ready' }, w2, { ...EMPTY_REVIEW, manual: true }).fields!.some((f) => f.hasValue), false)
check('summary words', [summaryStatus(view({ ...done, status: 'confirmed' })), summaryStatus(view({ ...EMPTY_REVIEW, status: 'skipped' })), summaryStatus(view())], ['confirmed', 'skipped', 'to-check'])

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
