// The filing flow, grouped into the 5 stepper sections (see FLOW.md).
export type Section = { id: string; label: string; steps: string[] }

export const sections: Section[] = [
  { id: 'about', label: 'About you', steps: ['Visa type', 'Years on this visa', 'State'] },
  // Citizenship placed here (tax-treaty check); to confirm with design.
  { id: 'tax', label: 'Tax details', steps: ['SSN or ITIN', 'Filed before', 'Country of citizenship'] },
  { id: 'income', label: 'Income', steps: ['Income sources'] },
  { id: 'documents', label: 'Documents', steps: ['Document checklist'] },
  { id: 'review', label: 'Review', steps: ['Review and submit'] },
]

/** Where the user is: section index and step index within it (both 0-based). */
export type FlowPosition = { section: number; step: number }

/** "2 of 3", or null for one-step sections (where "1 of 1" adds nothing). */
export function stepCount(position: FlowPosition): string | null {
  const total = sections[position.section].steps.length
  return total > 1 ? `${position.step + 1} of ${total}` : null
}

/** Every step in order, for moving forward and back. */
export const allSteps: FlowPosition[] = sections.flatMap((s, section) => s.steps.map((_, step) => ({ section, step })))
