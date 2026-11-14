// The user's answers, remembered for this browser tab (so Back shows what you
// picked, and a reload doesn't lose your place). Falls back to memory only if
// the browser blocks storage.
import { useSyncExternalStore } from 'react'

export type Answers = {
  visa?: 'F-1' | 'J-1' | 'M-1'
  enrolled?: 'yes' | 'no'
  years?: 'under5' | '5plus'
  state?: string // two-letter code
  taxId?: 'ssn' | 'itin' | 'none'
  filedBefore?: 'yes' | 'no'
  priorReturn?: 'skipped' | { fileName: string }
  citizenship?: string // two-letter region code
  income?: import('../data/income').IncomeId[]
  /** Income follow-up answers, keyed by screen id: a choice, an amount, file names, or "later" (skipped). */
  details?: Record<string, string | string[]>
}

const KEY = 'atlastax:answers'
const listeners = new Set<() => void>()

function load(): Answers {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Answers
  } catch {
    return {}
  }
}

let answers: Answers = load()

export function setAnswers(patch: Partial<Answers>) {
  answers = { ...answers, ...patch }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(answers))
  } catch {
    /* storage blocked: keep in memory */
  }
  listeners.forEach((l) => l())
}

/** Save one income follow-up answer. */
export function setDetail(id: string, value: string | string[]) {
  setAnswers({ details: { ...answers.details, [id]: value } })
}

export function useAnswers(): Answers {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => answers,
  )
}
