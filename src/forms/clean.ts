// The server's side: whatever arrived in the request body as `facts` → safe FormFacts. Pure.
import { EMPTY_FACTS, type FormFacts } from './types.ts'

const VISAS = ['F-1', 'J-1', 'M-1'] as const
const isYear = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1900 && (n as number) <= 2100

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
  }
}
