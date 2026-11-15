// The ONE function that says where the person's return stands. Home (hero,
// cards, button) and the Documents page (its stepper) read it, so they always
// agree. Built on resumeTarget() (questions) and requiredItems() (documents).
import { usStates } from '../data/places'
import { incomeOptions, extraOptions } from '../data/income'
import type { Answers } from '../flow/answers'
import { hasProgress } from '../flow/answers'
import { documentHref, requiredItems, summarizeItems, type ItemsSummary, type RequiredItem } from '../flow/requiredDocuments'
import { REVIEW_PATH, pathForSection, resumeTarget } from '../flow/screens'
import { at, sectionIndex, sections, type FlowPosition } from '../flow/sections'

export type HomeState = 'new' | 'in-progress' | 'needs-documents' | 'ready'
type Target = { path: string; state: Record<string, unknown> | null }

export type ReturnStatus = {
  state: HomeState
  headline: string
  buttonLabel: string
  buttonTarget: Target
  /** The progress row: where they are, and how many sections are done (0–6) */
  progress: { position: FlowPosition; done: number }
  /** Up to 3 next steps, each a link */
  nextSteps: { label: string; target: Target }[]
  documents: ItemsSummary
  items: RequiredItem[]
  /** Plain answers for "Your answers" (null = not answered yet), each with where to edit it */
  answers: { label: string; value: string | null; edit: string }[]
}

const docsIndex = sectionIndex('documents')

export function returnStatus(a: Answers, year: number): ReturnStatus {
  const items = requiredItems(a)
  const documents = summarizeItems(items)
  const resume = resumeTarget(a, year)
  const questionsDone = resume.position.section >= docsIndex

  const state: HomeState = !hasProgress(a) ? 'new' : !questionsDone ? 'in-progress' : !documents.done ? 'needs-documents' : 'ready'

  const incomeLabels = [...incomeOptions, ...extraOptions].filter((o) => a.income?.includes(o.id)).map((o) => o.label)
  const answers = [
    { label: 'Visa', value: a.visa ? (a.visa === 'J-1' && a.residency?.j1Student === 'yes' ? 'J-1 student' : a.visa) : null, edit: '/visa' },
    { label: 'State', value: usStates.find((s) => s.value === a.state)?.label ?? null, edit: '/state' },
    { label: 'Income', value: incomeLabels.length ? incomeLabels.join(', ') : null, edit: '/income' },
  ]

  const base = { documents, items, answers }
  if (state === 'new') {
    return {
      ...base,
      state,
      headline: 'Let’s start your return',
      buttonLabel: 'Start your return',
      buttonTarget: { path: resume.path, state: resume.state },
      progress: { position: at('about', 0, 1), done: 0 },
      nextSteps: [],
    }
  }
  if (state === 'in-progress') {
    const s = resume.position.section
    const nextSteps = [
      { label: `Finish ${sections[s].label}`, target: { path: resume.path, state: resume.state } },
      ...sections.slice(s + 1, s + 3).map((sec, i) => ({ label: sec.label, target: pathForSection(s + 1 + i, a, year) })),
    ]
    return {
      ...base,
      state,
      headline: `You’re on step ${s + 1} of ${sections.length}: ${sections[s].label}`,
      buttonLabel: 'Continue where you left off',
      buttonTarget: { path: resume.path, state: resume.state },
      progress: { position: resume.position, done: s },
      nextSteps,
    }
  }
  if (state === 'needs-documents') {
    const outstanding = items.filter((i) => (i.kind === 'document' ? i.status === 'missing' : i.status === 'details-needed'))
    return {
      ...base,
      state,
      headline: 'Next: add your documents',
      buttonLabel: 'Add documents',
      buttonTarget: { path: '/documents', state: { fromFlow: true } },
      progress: { position: at('documents'), done: docsIndex },
      nextSteps: outstanding.slice(0, 3).map((i) => ({ label: i.kind === 'document' ? `Add your ${i.form}` : `${i.incomeLabel}: details needed`, target: { path: documentHref(i.id), state: null } })),
    }
  }
  return {
    ...base,
    state,
    headline: 'Your return is ready',
    buttonLabel: 'Download your forms',
    // TODO: real forms. Review isn't built yet.
    buttonTarget: { path: REVIEW_PATH, state: null },
    progress: { position: at('review'), done: sections.length },
    nextSteps: [],
  }
}
