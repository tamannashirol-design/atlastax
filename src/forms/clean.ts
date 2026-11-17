// The server's side: whatever arrived in the request body as `facts` → safe FormFacts. Pure.
import { EMPTY_FACTS, type FormFacts } from './types.ts'

const VISAS = ['F-1', 'J-1', 'M-1'] as const
const isYear = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1900 && (n as number) <= 2100

/** The most characters kept for each part (the form's line holds one line of text: Form 8843, lines 9 and 10) */
export const CONTACT_LIMITS = { name: 60, address: 80, phone: 24 } as const

/** A typed or read name/address/phone → plain text: control characters dropped, spaces tidied, each part cut to its limit. */
export function cleanContact(x: unknown): FormFacts['school'] {
  const c = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
  const part = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')
  return { name: part(c.name, CONTACT_LIMITS.name), address: part(c.address, CONTACT_LIMITS.address), phone: part(c.phone, CONTACT_LIMITS.phone) }
}

/** Anything that doesn't look right is dropped, never trusted (the request comes from a browser). */
export function cleanFacts(x: unknown): FormFacts {
  const f = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
  const days: Record<string, number> = {}
  if (f.days && typeof f.days === 'object') {
    for (const [k, v] of Object.entries(f.days as Record<string, unknown>)) if (isYear(Number(k)) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 366) days[k] = v as number
  }
  return {
    ...EMPTY_FACTS,
    visa: (VISAS as readonly unknown[]).includes(f.visa) ? (f.visa as FormFacts['visa']) : null,
    citizenship: typeof f.citizenship === 'string' && /^[A-Za-z]{2}$/.test(f.citizenship) ? f.citizenship.toUpperCase() : null,
    days,
    daysComplete: f.daysComplete === true,
    studentYears: Array.isArray(f.studentYears) ? f.studentYears.filter(isYear).slice(0, 12) : [],
    inScope: typeof f.inScope === 'boolean' ? f.inScope : null,
    school: cleanContact(f.school),
    director: cleanContact(f.director),
    greenCard: f.greenCard === 'yes' || f.greenCard === 'no' ? f.greenCard : null,
  }
}
