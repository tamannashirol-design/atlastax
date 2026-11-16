// Shared shapes for the downloads. Pure types.
import type { FormId } from './templates.ts'

/** Text written on a page (not a form field): the India treaty words on line 12 */
export type Overlay = { page: number; x: number; y: number; size: number; maxWidth: number; text: string }

/**
 * One form, filled from the confirmed values. No PDF here: just what goes in which field (by the IRS's
 * own field name), and the honest lists. The server writes it into the official PDF.
 */
export type FormFill = {
  id: FormId
  status: 'ready' | 'not-ready'
  /** Why not, in plain words */
  reason?: string
  /** PDF field name → text, or true for a ticked box. Every ID number here is already masked (last 4 only). */
  values: Record<string, string | true>
  /** Overlays (text on the page itself) */
  overlays: Overlay[]
  /** What was left blank that the person may need to fill in by hand: "Line 9: school name, address and phone" */
  blank: string[]
  /** Worth a look: what the fill assumed */
  check: string[]
  /** Parts of the filing this download does not include */
  notIncluded: string[]
}

/**
 * What the browser knows that the forms need and the server doesn't: from the saved answers (visa,
 * citizenship, the days counted on the Time in the U.S. screens). Nothing sensitive: no travel
 * history, no ID numbers. Sent with the request, used once, never stored.
 */
export type FormFacts = {
  visa: 'F-1' | 'J-1' | 'M-1' | null
  /** Two-letter region code, as the citizenship question stores it */
  citizenship: string | null
  /** Days in the U.S. per calendar year Form 8843 asks days for (keys are years) */
  days: Record<string, number>
  /** Every day count is answered and nothing is flagged */
  daysComplete: boolean
  /** Calendar years counted as student years, up to the tax year */
  studentYears: number[]
  /** Within the v1 scope (the first 5 student years); null = not known yet */
  inScope: boolean | null
}

export const EMPTY_FACTS: FormFacts = { visa: null, citizenship: null, days: {}, daysComplete: false, studentYears: [], inScope: null }
