// Development only: Review's states without uploading anything (/review?review=…,
// linked from /motion). Sample documents built with the SAME rules as the server
// (logic.ts), from the mock reader's fake values. Nothing is sent or stored.
import { FAKE, NORMALLY_LOW } from '../../server/extraction/fakeValues.ts'
import { FIELDS } from '../extraction.config.ts'
import type { Backend } from './client'
import { FIXTURE_ITEMS, type ReviewFixture } from './fixtureNames'
import { applyPatch, effectiveValue, EMPTY_REVIEW, formFor, reviewView, canConfirm, type ReadingInfo, type SavedReview, type Suggestion } from './logic'

const suggestionsFor = (itemId: string): Suggestion[] => {
  const form = formFor(itemId)
  return FIELDS[form].map((f) => {
    const v = FAKE[form][f.key] ?? null
    return { key: f.key, suggested: v, confidence: v === null ? 'missing' : NORMALLY_LOW.has(f.key) ? 'low' : 'high' }
  })
}
const allTicked = (itemId: string): SavedReview => ({
  status: 'open',
  manual: false,
  fields: Object.fromEntries(FIELDS[formFor(itemId)].map((f) => [f.key, { ticked: true, notOnForm: !FAKE[formFor(itemId)][f.key] && !!f.mayBeBlank, edited: false }])),
})

export function fixtureBackend(name: ReviewFixture): Backend {
  const ready: ReadingInfo = { status: 'ready' }
  const reading: Record<string, ReadingInfo> = { passport: ready, i94: ready, 'opt-cpt': ready }
  const saved: Record<string, SavedReview> = { passport: EMPTY_REVIEW, i94: EMPTY_REVIEW, 'opt-cpt': EMPTY_REVIEW }
  if (name === 'ticked') saved.passport = allTicked('passport')
  if (name === 'failed') reading.passport = { status: 'failed', failure: 'unreadable' }
  if (name === 'wrongtype') reading['opt-cpt'] = { status: 'failed', failure: 'wrong-type' }
  if (name === 'replace') reading['opt-cpt'] = { status: 'reading' }
  if (name === 'summary') {
    saved.passport = { ...allTicked('passport'), status: 'confirmed' }
    saved.i94 = { ...EMPTY_REVIEW, status: 'skipped' }
  }
  const view = (id: string) => reviewView(id, formFor(id), reading[id], reading[id]?.status === 'ready' ? suggestionsFor(id) : null, saved[id])
  return {
    list: async () => FIXTURE_ITEMS.map((i) => view(i.id)),
    async save(id, body) {
      let next = saved[id]
      if (typeof body.manual === 'boolean') next = { ...next, manual: body.manual }
      if (body.fields) next = applyPatch(next, formFor(id), body.fields, (k) => effectiveValue(next.fields[k], suggestionsFor(id).find((s) => s.key === k), next.manual))
      saved[id] = next
      if (body.status === 'confirmed' && !canConfirm(view(id).fields)) return 'not-done'
      if (body.status) saved[id] = { ...saved[id], status: body.status }
      return view(id)
    },
    reveal: async (id, key) => effectiveValue(saved[id].fields[key], suggestionsFor(id).find((s) => s.key === key), saved[id].manual),
  }
}
