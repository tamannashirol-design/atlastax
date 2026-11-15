// Review ("Check your details"): the rules, as pure functions. No React, no network.
// Used by the server (server/review.ts: what it stores and sends) AND the screens,
// so both always agree. Tested by `npm run check:review`.
//
// TICK RULE (designer decision; which fields: ONLY extraction.config.ts `needsTick`):
//   - every value that goes into a tax form or identifies the person needs its own
//     "This is correct" tick, whatever the confidence
//   - other details need a tick only when the reader marked them "Please check"
//   - a value the reader didn't find must be typed (or "Not on my form", where allowed)
//   - editing a value clears its tick
// ID numbers (SSN, ITIN, EIN, passport) leave the server masked (mask()); the full
// value is sent only when the person presses Show (reveal).
import { FIELDS, ITEM_FORMS, type FieldKind, type FieldSpec, type FormType } from '../extraction.config.ts'
import { mask, maskSpoken, type SensitiveId } from '../lib/mask.ts'

export type Confidence = 'high' | 'low' | 'missing'

/** What the reader found for one field (server side; never sent as is) */
export type Suggestion = { key: string; suggested: string | null; confidence: Confidence }

/** What the person did with one field (stored on the server) */
export type SavedField = { value?: string; ticked: boolean; notOnForm: boolean; edited: boolean }

/** A document's review state on the server */
export type SavedReview = { status: 'open' | 'confirmed' | 'skipped'; manual: boolean; fields: Record<string, SavedField> }

/** One field as the screen gets it */
export type ReviewField = {
  key: string
  label: string
  box?: string
  kind: FieldKind
  sensitive?: SensitiveId
  needsTick: boolean
  mayBeBlank: boolean
  confidence: Confidence
  /** The value to show: the person's own, else the suggestion. MASKED for sensitive fields. '' = nothing */
  shown: string
  /** Sensitive fields: what a screen reader says instead of the bullets (maskSpoken) */
  spoken?: string
  hasValue: boolean
  ticked: boolean
  notOnForm: boolean
  edited: boolean
}

export type ReadingInfo = { status: 'queued' | 'reading' | 'checking' | 'ready' | 'failed'; failure?: 'unreadable' | 'wrong-type' | 'blurry' | 'rotated' | 'other' } | null

/** One document as the Review screens get it */
export type ReviewDoc = {
  itemId: string
  form: FormType
  /** The latest reading (null: not read yet) */
  reading: ReadingInfo
  status: SavedReview['status']
  /** "Enter it myself": the fields start empty, nothing suggested */
  manual: boolean
  /** null while there's nothing to check yet (being read, couldn't read, not read) */
  fields: ReviewField[] | null
}

export const EMPTY_REVIEW: SavedReview = { status: 'open', manual: false, fields: {} }
const EMPTY_FIELD: SavedField = { ticked: false, notOnForm: false, edited: false }

export const formFor = (itemId: string, found?: FormType): FormType => {
  const forms = ITEM_FORMS[itemId] ?? []
  return found && forms.includes(found) ? found : forms[0]
}

/** The value that counts for a field: the person's own, else the suggestion (never for "Enter it myself") */
export function effectiveValue(saved: SavedField | undefined, s: Suggestion | undefined, manual: boolean): string {
  if (saved?.value !== undefined) return saved.value
  return manual ? '' : (s?.suggested ?? '')
}

/** Build what the screen sees. `suggestions` null = nothing read (being read, failed, or not yet). */
export function reviewView(itemId: string, form: FormType, reading: ReadingInfo, suggestions: Suggestion[] | null, saved: SavedReview): ReviewDoc {
  const canShowFields = saved.manual || (reading?.status === 'ready' && suggestions !== null)
  const fields = canShowFields
    ? FIELDS[form].map((spec) => {
        const s = saved.manual ? undefined : suggestions?.find((x) => x.key === spec.key)
        const f = saved.fields[spec.key] ?? EMPTY_FIELD
        const value = effectiveValue(f, s, saved.manual)
        return fieldView(spec, saved.manual ? 'missing' : (s?.confidence ?? 'missing'), value, f)
      })
    : null
  return { itemId, form, reading, status: saved.status, manual: saved.manual, fields }
}

function fieldView(spec: FieldSpec, confidence: Confidence, value: string, f: SavedField): ReviewField {
  const v = value.trim()
  return {
    key: spec.key,
    label: spec.label,
    box: spec.box,
    kind: spec.kind,
    sensitive: spec.sensitive,
    needsTick: spec.needsTick,
    mayBeBlank: !!spec.mayBeBlank,
    confidence,
    shown: spec.sensitive ? mask(v, spec.sensitive) : v,
    ...(spec.sensitive ? { spoken: maskSpoken(v, spec.sensitive) } : {}),
    hasValue: v.length > 0,
    ticked: f.ticked,
    notOnForm: !!spec.mayBeBlank && f.notOnForm,
    edited: f.edited,
  }
}

/** Does this field still need something? 'type' a value, 'tick' it, or nothing (null). */
export function fieldNeeds(f: Pick<ReviewField, 'hasValue' | 'ticked' | 'notOnForm' | 'mayBeBlank' | 'needsTick' | 'confidence'>): 'type' | 'tick' | null {
  if (f.mayBeBlank && f.notOnForm) return null
  if (!f.hasValue) return 'type'
  if ((f.needsTick || f.confidence === 'low') && !f.ticked) return 'tick'
  return null
}

/** Shows a "This is correct" box (only once there's a value to agree with) */
export const showsTick = (f: Pick<ReviewField, 'hasValue' | 'needsTick' | 'confidence' | 'notOnForm'>) => !f.notOnForm && f.hasValue && (f.needsTick || f.confidence === 'low')

export function leftToDo(fields: ReviewField[]) {
  const needs = fields.map(fieldNeeds)
  return { tick: needs.filter((n) => n === 'tick').length, type: needs.filter((n) => n === 'type').length }
}

export const canConfirm = (fields: ReviewField[] | null) => !!fields && fields.every((f) => fieldNeeds(f) === null)

/** "2 details to check and 1 to type" · null when nothing is left */
export function leftLine(fields: ReviewField[]): string | null {
  const { tick, type } = leftToDo(fields)
  if (!tick && !type) return null
  const d = (n: number) => `${n} ${n === 1 ? 'detail' : 'details'}`
  if (tick && type) return `${d(tick)} to check and ${type} to type`
  return tick ? `${d(tick)} to check` : `${d(type)} to type`
}

/** A change from the screen to one field */
export type FieldPatch = { value?: string; ticked?: boolean; notOnForm?: boolean }

const MAX_VALUE = 100

/**
 * Apply the screen's changes. Server and fixtures both use this, so "editing clears
 * the tick" can't be skipped. Unknown keys and over-long values are dropped.
 * `current` gives the value that counts now (to tell a real edit from the same text).
 */
export function applyPatch(saved: SavedReview, form: FormType, patch: Record<string, FieldPatch>, current: (key: string) => string): SavedReview {
  const specs = new Map(FIELDS[form].map((s) => [s.key, s]))
  const fields = { ...saved.fields }
  for (const [key, p] of Object.entries(patch)) {
    const spec = specs.get(key)
    if (!spec || !p || typeof p !== 'object') continue
    const f = { ...(fields[key] ?? EMPTY_FIELD) }
    if (typeof p.value === 'string' && p.value.length <= MAX_VALUE && p.value !== current(key)) {
      f.value = p.value
      f.edited = true
      f.ticked = false // editing a value clears its tick
    }
    if (typeof p.ticked === 'boolean' && p.value === undefined) f.ticked = p.ticked
    if (typeof p.notOnForm === 'boolean' && spec.mayBeBlank) {
      f.notOnForm = p.notOnForm
      if (p.notOnForm) f.ticked = false
    }
    fields[key] = f
  }
  // Any change reopens a confirmed document
  return { ...saved, status: saved.status === 'confirmed' ? 'open' : saved.status, fields }
}

/** The summary's word for each document */
export type SummaryStatus = 'confirmed' | 'skipped' | 'to-check' | 'reading' | 'couldnt-read' | 'wrong-type'

export function summaryStatus(d: ReviewDoc): SummaryStatus {
  if (d.status === 'confirmed') return 'confirmed'
  if (d.status === 'skipped') return 'skipped'
  if (d.fields) return 'to-check'
  if (d.reading?.status === 'failed') return d.reading.failure === 'wrong-type' ? 'wrong-type' : 'couldnt-read'
  return 'reading'
}

export const SUMMARY_TEXT: Record<SummaryStatus, string> = {
  confirmed: 'Confirmed',
  skipped: 'Skipped for now',
  'to-check': 'Not checked yet',
  reading: 'Being read',
  'couldnt-read': 'Couldn’t read',
  'wrong-type': 'Wrong document',
}

/** What the screen says when a document has no fields to check */
export function failureLine(d: Pick<ReviewDoc, 'reading'>, formName: string): string {
  switch (d.reading?.failure) {
    case 'wrong-type':
      return `This doesn’t look like a ${formName}. Add the right file, or enter the details yourself.`
    case 'blurry':
      return 'This photo is too blurry to read. Add a sharper one, or enter the details yourself.'
    case 'rotated':
      return 'This photo is sideways or upside down. Add an upright one, or enter the details yourself.'
    default:
      return 'We couldn’t read this one. Try again, or enter the details yourself.'
  }
}
