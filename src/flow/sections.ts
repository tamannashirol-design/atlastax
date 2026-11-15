// The filing flow's sections, in order: the ONE place the stepper reads.
// Steps aren't hard-coded: each question screen names its section, and the
// "x of n" counts only the screens that apply to this person (positionOf in
// screens.tsx). The compact stepper has one segment per section.
export type SectionId = 'about' | 'time' | 'tax' | 'income' | 'documents' | 'review'
export type Section = { id: SectionId; label: string }

export const sections: Section[] = [
  { id: 'about', label: 'About you' },
  { id: 'time', label: 'Time in the U.S.' },
  { id: 'tax', label: 'Tax details' },
  { id: 'income', label: 'Income' },
  { id: 'documents', label: 'Documents' },
  { id: 'review', label: 'Review' },
]

export const sectionIndex = (id: SectionId) => sections.findIndex((s) => s.id === id)

/** Where the person is: section index, step within it, and how many steps that section has for them (all 0-based except steps). */
export type FlowPosition = { section: number; step: number; steps: number }

/** A position by section id (pages like Documents and Review are one step). */
export const at = (id: SectionId, step = 0, steps = 1): FlowPosition => ({ section: sectionIndex(id), step, steps })

/** "2 of 3", or null for one-step sections (where "1 of 1" adds nothing). */
export function stepCount(position: FlowPosition): string | null {
  return position.steps > 1 ? `${position.step + 1} of ${position.steps}` : null
}
