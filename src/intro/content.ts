import type { ReactNode } from 'react'
import type { FlowPosition } from '../flow/sections'
import { FormDemo, UploadDemo, VisaDemo, type SceneProps } from './scenes'

// The intro's scenes, in order. Headings are from the design brief.
// TODO confirm: the body lines are draft copy. They avoid promises (no
// refunds, speed, savings or "free") and invented numbers.
export type Scene = {
  id: string
  title: string
  body: string
  Demo: (p: SceneProps) => ReactNode
  /** What the (screen-reader-hidden) demo shows, in words, for the wide intro's demo panel */
  demoText: string
  /** The laptop preview (wide intro): the question screen the demo sits in */
  preview: { position: FlowPosition; question: string; helper?: string }
}

export const scenes: Scene[] = [
  {
    id: 'questions',
    title: 'Answer a few simple questions',
    body: 'One question at a time, about your visa, your studies and your income.',
    Demo: VisaDemo,
    demoText: 'Preview of the visa question: F‑1 is selected, and Continue is ready.',
    preview: { position: { section: 0, step: 0 }, question: 'What is your visa type?', helper: 'To personalize the experience and show only visa‑relevant forms' },
  },
  {
    id: 'documents',
    title: 'Add your documents',
    body: 'Upload forms like your W-2 as a PDF or a clear photo.',
    Demo: UploadDemo,
    demoText: 'Preview of an upload question: an example W‑2 from Example Employer is uploaded.',
    preview: { position: { section: 2, step: 0 }, question: 'Upload your W‑2', helper: 'From your employer. One per employer' },
  },
  {
    id: 'forms',
    title: 'Get your forms, ready to file',
    body: 'We prepare Form 1040‑NR from your answers for you to download.',
    Demo: FormDemo,
    demoText: 'Preview of a finished Form 1040‑NR with example data, ready to download.',
    preview: { position: { section: 4, step: 0 }, question: 'Your forms are ready', helper: 'Review your forms to confirm everything is correct before submitting' },
  },
]
