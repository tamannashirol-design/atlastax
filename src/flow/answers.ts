// The user's answers, remembered for this browser tab (so Back shows what you
// picked, and a reload doesn't lose your place). Falls back to memory only if
// the browser blocks storage.
import { useSyncExternalStore } from 'react'

export type Answers = {
  visa?: 'F-1' | 'J-1' | 'M-1'
  years?: 'under5' | '5plus'
  state?: string // two-letter code
  taxId?: 'ssn' | 'itin' | 'none'
  filedBefore?: 'yes' | 'no'
  priorReturn?: 'skipped' | { fileName: string }
  citizenship?: string // two-letter region code
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

export function useAnswers(): Answers {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => answers,
  )
}
