// Reading the CONFIRMED values for the forms, and small formatters. Pure.
//
// The same rule as the tax input (src/tax/input.ts): a value is used only if its document is
// confirmed and the value is properly confirmed (ticked where a tick is needed). Anything else is
// treated as not there, so the field is left blank and listed.
//
// ID numbers (SSN or ITIN, passport number) are read here ONLY to be masked: the functions below return
// the masked text (last 4 characters only, src/lib/mask.ts) and nothing else leaves this file.
import { FIELDS, type FormType } from '../extraction.config.ts'
import { mask, maskForBox, type SensitiveId } from '../lib/mask.ts'
import type { ConfirmedDocument } from '../tax/input.ts'

/** A confirmed value, or null (no such document, not confirmed, not ticked, blank, or "Not on my form"). */
export function confirmedValue(docs: readonly ConfirmedDocument[], form: FormType, key: string): string | null {
  const spec = FIELDS[form].find((s) => s.key === key)
  if (!spec) return null
  for (const doc of docs) {
    if (doc.form !== form || doc.status !== 'confirmed') continue
    const f = doc.fields[key]
    if (!f) continue
    if (f.notOnForm && spec.mayBeBlank) continue
    const text = f.value.trim()
    if (!text) continue
    if ((spec.needsTick || f.confidence === 'low') && !f.ticked) continue
    return text
  }
  return null
}

/** A confirmed ID number, masked (last 4 only). null when there isn't one. `maxLength`: the box holds at most this many characters. */
export function maskedId(docs: readonly ConfirmedDocument[], form: FormType, key: string, kind: SensitiveId, maxLength?: number): string | null {
  const v = confirmedValue(docs, form, key)
  if (!v) return null
  return maxLength ? maskForBox(v, kind, maxLength) : mask(v, kind)
}

/** "SAMPLE PERSON" → first "SAMPLE", last "PERSON" (the last word is the last name, everything before it the first name and initial). */
export function splitName(full: string): { first: string; last: string } {
  const words = full.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return { first: '', last: words[0] ?? '' }
  return { first: words.slice(0, -1).join(' '), last: words[words.length - 1] }
}

/** "2025-08-15" → "08/15/2025"; null for anything else. */
export function toMDY(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? '').trim())
  return m ? `${m[2]}/${m[3]}/${m[1]}` : null
}

/** "F1" → "F-1", "j-1" → "J-1"; anything else as typed (trimmed, upper-case). */
export function visaLabel(code: string | null | undefined): string | null {
  const t = (code ?? '').trim().toUpperCase()
  if (!t) return null
  const m = /^([A-Z])-?(\d)$/.exec(t)
  return m ? `${m[1]}-${m[2]}` : t
}

/** "IN" → "India". null when it isn't a region code. */
export function countryName(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null
  try {
    const n = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase())
    return n && n !== code.toUpperCase() ? n : null
  } catch {
    return null
  }
}

/** Whole dollars with thousands commas, from cents: 3845000 → "38,450". */
export const dollars = (cents: number): string => Math.round(cents / 100).toLocaleString('en-US')
