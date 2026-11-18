// Review on the server: what the person confirmed, per person + tax year + document.
// Rules (ticks, masking, "editing clears the tick") come ONLY from src/review/logic.ts.
//
//   GET  /api/review?year=2025                    → { documents: ReviewDoc[] } (every readable document with files)
//   PUT  /api/review/:itemId?year=2025             { fields?, status?, manual? } → ReviewDoc
//          status "confirmed" is accepted only when every detail is done (409 otherwise)
//   GET  /api/review/:itemId/reveal?year=&key=     → { value } (Show: one sensitive value, in full)
//
// ID numbers leave masked; only "reveal" sends one in full, on request. Kept in
// memory (prototype): a server restart forgets it. Never logged.
import { FIELDS, ITEM_FORMS } from '../src/extraction.config.ts'
import { applyPatch, effectiveValue, EMPTY_REVIEW, formFor, reviewView, type FieldPatch, type ReviewDoc, type SavedReview, type Suggestion, canConfirm } from '../src/review/logic.ts'
import type { ConfirmedDocument } from '../src/tax/input.ts'
import type { readingJobs } from './extraction/jobs.ts'
import type { FileMeta } from './storage.ts'

type Jobs = ReturnType<typeof readingJobs>

export function reviewStore(jobs: Jobs, listFiles: (sessionId: string) => Promise<FileMeta[]>) {
  const saved = new Map<string, SavedReview>() // "<session>:<year>:<item>"
  const keyOf = (s: string, y: number, i: string) => `${s}:${y}:${i}`
  // New or removed files: the earlier checks no longer apply
  jobs.whenFilesChange((s, y, i) => saved.delete(keyOf(s, y, i)))

  function parts(sessionId: string, year: number, itemId: string) {
    const r = jobs.reading(sessionId, year, itemId)
    const form = formFor(itemId, r?.form)
    const suggestions: Suggestion[] | null = r?.fields ? r.fields.map((f) => ({ key: f.key, suggested: f.suggested, confidence: f.confidence })) : null
    const s = saved.get(keyOf(sessionId, year, itemId)) ?? EMPTY_REVIEW
    return { r, form, suggestions, s }
  }

  function view(sessionId: string, year: number, itemId: string): ReviewDoc {
    const { r, form, suggestions, s } = parts(sessionId, year, itemId)
    return reviewView(itemId, form, r ? { status: r.status, ...(r.failure ? { failure: r.failure } : {}) } : null, suggestions, s)
  }

  return {
    async list(sessionId: string, year: number) {
      const items = new Set((await listFiles(sessionId)).filter((m) => m.year === year && m.itemId && m.itemId in ITEM_FORMS).map((m) => m.itemId!))
      return [...items].map((i) => view(sessionId, year, i))
    },

    /** "Delete my documents": forget what this person confirmed or typed (the extracted values too, in the jobs) for every document `covers`. */
    forget(sessionId: string, covers: (itemId: string) => boolean = () => true) {
      for (const key of [...saved.keys()]) {
        const [s, , itemId] = key.split(':')
        if (s === sessionId && covers(itemId)) saved.delete(key)
      }
    },

    /** null: not a document this person has. 'not-done': asked to confirm with details left. */
    async save(sessionId: string, year: number, itemId: string, body: Record<string, unknown>): Promise<ReviewDoc | null | 'not-done'> {
      if (!(itemId in ITEM_FORMS) || !(await jobs.hasFiles(sessionId, year, itemId))) return null
      const { form, suggestions, s } = parts(sessionId, year, itemId)
      let next: SavedReview = { ...s }
      if (typeof body.manual === 'boolean') next = { ...next, manual: body.manual }
      if (body.fields && typeof body.fields === 'object') {
        const current = (key: string) => effectiveValue(next.fields[key], suggestions?.find((x) => x.key === key), next.manual)
        next = applyPatch(next, form, body.fields as Record<string, FieldPatch>, current)
      }
      if (body.status === 'open' || body.status === 'skipped' || body.status === 'confirmed') {
        if (body.status === 'confirmed') {
          saved.set(keyOf(sessionId, year, itemId), next)
          if (!canConfirm(view(sessionId, year, itemId).fields)) return 'not-done'
        }
        next = { ...next, status: body.status }
      }
      saved.set(keyOf(sessionId, year, itemId), next)
      return view(sessionId, year, itemId)
    },

    /** Show: the full value of ONE sensitive field (the person's own, else the suggestion). */
    reveal(sessionId: string, year: number, itemId: string, key: string): string | null {
      if (!(itemId in ITEM_FORMS)) return null
      const { r, form, suggestions, s } = parts(sessionId, year, itemId)
      // Only this person's own document: read, or being entered by hand
      if (!r && !s.manual && !saved.has(keyOf(sessionId, year, itemId))) return null
      const spec = FIELDS[form].find((f) => f.key === key)
      if (!spec?.sensitive) return null
      return effectiveValue(s.fields[key], suggestions?.find((x) => x.key === key), s.manual)
    },

    /** Every document this person has, with each value, tick and "Not on my form" as saved: input for buildTaxInput (R1). Server side only. */
    async taxDocuments(sessionId: string, year: number): Promise<ConfirmedDocument[]> {
      const items = new Set((await listFiles(sessionId)).filter((m) => m.year === year && m.itemId && m.itemId in ITEM_FORMS).map((m) => m.itemId!))
      return [...items].map((itemId) => {
        const { form, suggestions, s } = parts(sessionId, year, itemId)
        const fields = Object.fromEntries(
          FIELDS[form].map((spec) => {
            const sug = suggestions?.find((x) => x.key === spec.key)
            const f = s.fields[spec.key]
            return [spec.key, { value: effectiveValue(f, sug, s.manual), ticked: !!f?.ticked, notOnForm: !!f?.notOnForm, confidence: s.manual ? 'missing' : (sug?.confidence ?? 'missing') }]
          }),
        )
        return { itemId, form, status: s.status, fields } as ConfirmedDocument
      })
    },

    /** Confirmed values for the downloads later (Part 3). Server side only. */
    confirmed(sessionId: string, year: number, itemId: string) {
      const { suggestions, s, form } = parts(sessionId, year, itemId)
      if (s.status !== 'confirmed') return null
      return Object.fromEntries(FIELDS[form].map((f) => [f.key, effectiveValue(s.fields[f.key], suggestions?.find((x) => x.key === f.key), s.manual)]))
    },
  }
}
