// TIME IN THE U.S.: who is supported, the student limit, how days are counted.
//
// TODO confirm with CPA: every rule and number in this file is a PLACEHOLDER
// until a tax professional confirms it. This is the only place these rules
// live; src/residency/residency.ts and src/residency/days.ts read them. The UI
// shows the working and lets the person correct it; it gives no advice and
// never decides a filing status.

/** Supported for now: students only. F-1 (including OPT and CPT) and M-1 always; J-1 only as a student. */
export const STUDENT_VISAS = { always: ['F-1', 'M-1'], askIfStudent: ['J-1'] } as const

/** Neutral message for anyone outside that scope (no calculation is done). */
export const UNSUPPORTED_MESSAGE = 'We don’t support this yet.'

/**
 * v1 SCOPE. TODO confirm with CPA. AtlasTax prepares a return only when the
 * tax year is within the person's first STUDENT_LIMIT_YEARS calendar years in
 * student status (F-1 including OPT and CPT, J-1 student, M-1). Every
 * calendar year with any presence in the U.S. counts, a calendar year spent
 * entirely abroad doesn't, and the tax year itself counts: the first year
 * outside scope is the sixth. Outside scope, the flow stops (stop screen).
 */
export const STUDENT_LIMIT_YEARS = 5

/**
 * TODO (unused for now: only students are supported). J-1 researchers,
 * professors, scholars and trainees: not exempt this year if exempt (in any
 * category) for any part of `limit` of the `window` prior calendar years.
 * The Form 8843 "Exception" (foreign employer paid everything) isn't modelled.
 */
export const TEACHER_TRAINEE_RULE = { window: 6, limit: 2 }

/**
 * TODO confirm with CPA. Any part of a day counts as a day in the U.S. (the
 * Form 8843 instructions say so): the days you leave and come back count as
 * days in the U.S.; only the days in between are days abroad.
 */
export const DAY_COUNTING = { leaveDayInUS: true, returnDayInUS: true }

/** Form 8843 line 4a asks for days in the tax year and the 2 years before it. */
export const FORM_8843_DAY_YEARS = 3

/** A CBP travel history with this many rows may be cut off. TODO confirm with CPA. */
export const CBP_HISTORY_ROW_LIMIT = 100

/** Helper beside the travel-history upload. TODO confirm URL wording ("View Travel History"). */
export const CBP_HELPER = 'Get it from the CBP I-94 website (i94.cbp.dhs.gov) under “View Travel History”. Download or print it as a PDF.'

/** How far back the arrival-year list goes. */
export const ARRIVAL_YEARS_BACK = 15

/** The stop screen (and Home) for anyone outside the v1 scope. Neutral: no advice, no jargon, never "resident". */
export const OUT_OF_SCOPE = {
  headline: 'We can’t prepare your return yet',
  body: 'AtlasTax currently supports students in their first five calendar years in the U.S. Based on your answers, your situation may need a different type of return.',
  // TODO confirm wording
  note: 'Your school’s international office or a tax professional can tell you which return applies.',
}
