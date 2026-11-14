import type { ReactNode } from 'react'
import { FormDemo, UploadDemo, VisaDemo, type SceneProps } from './scenes'

// The intro's scenes, in order. Headings are from the design brief.
// TODO confirm: the body lines are draft copy. They avoid promises (no
// refunds, speed, savings or "free") and invented numbers.
export type Scene = { id: string; title: string; body: string; Demo: (p: SceneProps) => ReactNode }

export const scenes: Scene[] = [
  {
    id: 'questions',
    title: 'Answer a few simple questions',
    body: 'One question at a time, about your visa, your studies and your income.',
    Demo: VisaDemo,
  },
  {
    id: 'documents',
    title: 'Add your documents',
    body: 'Upload forms like your W-2 as a PDF or a clear photo.',
    Demo: UploadDemo,
  },
  {
    id: 'forms',
    title: 'Get your forms, ready to file',
    body: 'We prepare Form 1040‑NR from your answers for you to download.',
    Demo: FormDemo,
  },
]
