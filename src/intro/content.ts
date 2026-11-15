import type { ReactNode } from 'react'
import { at, type FlowPosition } from '../flow/sections'
import { FORM_MOMENT_MS, FormDemo, QUESTIONS_MOMENT_MS, UPLOAD_MOMENT_MS, UploadDemo, VisaDemo, type SceneProps } from './scenes'

// The intro's scenes, in order. Headings are from the design brief.
// The intro is built from this array alone (step dots, tabs, timing, live
// region), so a fourth scene can be added here without layout changes.
// Planned (FLOW.md): a "documents deleted" scene, once that feature exists.
// TODO confirm: the body lines are draft copy. They avoid promises (no
// refunds, speed, savings or "free") and invented numbers.
export type Scene = {
  id: string
  title: string
  body: string
  Demo: (p: SceneProps) => ReactNode
  /** What the (screen-reader-hidden) demo shows, in words, for the wide intro's demo panel */
  demoText: string
  /** The laptop preview (wide intro): the screen the demo sits in. No question = the demo draws its own. */
  preview: { position: FlowPosition; question?: string; helper?: string }
  /** How long the scene's moment lasts; the intro moves on SCENE_GAP_MS after it ends */
  moment: number
}

/** Pause after a scene's moment ends before the next scene (auto-advance only). */
export const SCENE_GAP_MS = 1000

export const scenes: Scene[] = [
  {
    id: 'questions',
    title: 'Answer a few simple questions',
    body: 'One question at a time, about your visa, your studies and your income.',
    Demo: VisaDemo,
    demoText: 'Preview of two questions: for visa type, F‑1 is picked; for being enrolled at a U.S. university or college, Yes is picked.',
    preview: { position: at('about', 0, 4) },
    moment: QUESTIONS_MOMENT_MS,
  },
  {
    id: 'documents',
    title: 'Add your documents',
    body: 'Upload forms like your W-2 as a PDF or a clear photo.',
    Demo: UploadDemo,
    demoText: 'Preview of an upload question: an example W‑2 from Example Employer is uploaded.',
    preview: { position: at('income'), question: 'Upload your W‑2', helper: 'From your employer. One per employer' },
    moment: UPLOAD_MOMENT_MS,
  },
  {
    id: 'forms',
    title: 'Get your forms, ready to file',
    body: 'We prepare Form 1040‑NR from your answers for you to download.',
    Demo: FormDemo,
    demoText: 'Preview of a finished Form 1040‑NR with example data, ready to download.',
    preview: { position: at('review'), question: 'Your forms are ready', helper: 'Review your forms to confirm everything is correct before submitting' },
    moment: FORM_MOMENT_MS,
  },
]
