// Masking for sensitive ID numbers: SSN, ITIN, EIN, passport number.
// The ONE place that formats them for display. Used by the browser and (later)
// the server, for screens, live-region announcements, and error messages.
// Never show, log or announce one of these numbers any other way.
//
//   SSN / ITIN   •••-••-6789
//   EIN          ••-•••6789
//   Passport     •••••6789
//
// Only the last 4 characters are ever shown, and only when the value is long
// enough that 4 characters are a small part of it (otherwise nothing is shown).
// The number of bullets is fixed, so the mask doesn't reveal the length.

export type SensitiveId = 'ssn' | 'itin' | 'ein' | 'passport'

const BULLET = '•'
const b = (n: number) => BULLET.repeat(n)

/** Shortest value whose last 4 characters may be shown. */
const MIN_LENGTH = 8

const PATTERNS: Record<SensitiveId, (last4: string) => string> = {
  ssn: (l) => `${b(3)}-${b(2)}-${l}`,
  itin: (l) => `${b(3)}-${b(2)}-${l}`,
  ein: (l) => `${b(2)}-${b(3)}${l}`,
  passport: (l) => `${b(5)}${l}`,
}

/** Names for what's announced to screen readers ("SSN ending in 6 7 8 9"). */
export const SENSITIVE_ID_NAMES: Record<SensitiveId, string> = {
  ssn: 'SSN',
  itin: 'ITIN',
  ein: 'EIN',
  passport: 'Passport number',
}

/** Letters and digits only (drops dashes, spaces, dots). */
const clean = (value: string) => value.replace(/[^0-9a-z]/gi, '').toUpperCase()

/** The last 4 characters, or null when the value is too short to show any. */
function last4(value: string | null | undefined): string | null {
  const v = clean(value ?? '')
  return v.length >= MIN_LENGTH ? v.slice(-4) : null
}

/** What the screen shows, e.g. "•••-••-6789". Empty string for no value. */
export function mask(value: string | null | undefined, kind: SensitiveId): string {
  if (!value || !clean(value)) return ''
  const l = last4(value)
  return PATTERNS[kind](l ?? b(4))
}

/**
 * The mask for a form box that holds at most `maxLength` characters (the 1040-NR identifying number
 * holds 9). The usual mask if it fits; otherwise bullets up to the limit, then the last 4. Still only
 * the last 4 characters are ever shown.
 */
export function maskForBox(value: string | null | undefined, kind: SensitiveId, maxLength: number): string {
  const full = mask(value, kind)
  if (full.length <= maxLength) return full
  const l = last4(value)
  return b(Math.max(0, maxLength - 4)) + (l ?? b(4))
}

/**
 * What a screen reader says instead of the bullets, e.g. "SSN ending in 6 7 8 9"
 * (digits spaced so they're read one by one). Render the mask with
 * aria-hidden and this text in a visually hidden span next to it.
 */
export function maskSpoken(value: string | null | undefined, kind: SensitiveId): string {
  const name = SENSITIVE_ID_NAMES[kind]
  if (!value || !clean(value)) return `${name} not added`
  const l = last4(value)
  return l ? `${name} ending in ${l.split('').join(' ')}` : `${name}, hidden`
}
