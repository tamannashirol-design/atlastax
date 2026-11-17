// Form 8843 lines 9 and 10 (Part III, students): the school and the program director. Pure (no React).
// The person types them, or uploads an I-20 (F-1, M-1) or DS-2019 (J-1) to fill them in.
// TODO: real reading of the file comes later. Until then an upload fills in SAMPLE details (fake, like the sample trips from a
// travel history) and the screen says so: the person checks every field. Nothing from a file is ever used unchecked.
import type { ContactAnswers } from '../flow/answers.ts'

export const SCHOOL_DOC = 'I-20 or DS-2019'

export const SAMPLE_SCHOOL: { school: Required<ContactAnswers>; director: Required<ContactAnswers> } = {
  school: { name: 'Sample University (FAKE)', address: '1 Example Street, Sampleville, NY 10001', phone: '555-555-0100' },
  director: { name: 'Pat Sample (FAKE)', address: '', phone: '555-555-0101' },
}

/** Fill only the parts still empty: what the person already typed is never overwritten. */
export function fillFrom(current: ContactAnswers | undefined, read: ContactAnswers): ContactAnswers {
  const out: ContactAnswers = { ...current }
  for (const k of ['name', 'address', 'phone'] as const) if (!out[k]?.trim() && read[k]) out[k] = read[k]
  return out
}

/** The two things the question needs to move on: a school name and a program director name. The rest may be left blank (the form lists it). */
export const schoolAnswered = (school: ContactAnswers | undefined, director: ContactAnswers | undefined) => !!school?.name?.trim() && !!director?.name?.trim()
