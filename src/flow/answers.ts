// The user's answers, remembered for this browser tab (so Back shows what you
// picked, and a reload doesn't lose your place). Falls back to memory only if
// the browser blocks storage.
import { useSyncExternalStore } from 'react'
import { TAX_YEAR } from '../config'

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

// Answers are kept per tax year, so starting a previous year never touches
// the current year's answers. `year` is the return being worked on now.
type Store = { year: number; years: Record<string, Answers> }

const KEY = 'atlastax:returns'
const EMPTY: Answers = {}
const listeners = new Set<() => void>()

function load(): Store {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Store | null
    if (s && typeof s.year === 'number' && s.years) return s
  } catch {
    /* fall through */
  }
  return { year: TAX_YEAR, years: {} }
}

let store: Store = load()
let answers: Answers = store.years[store.year] ?? EMPTY

function commit(next: Store) {
  store = next
  answers = store.years[store.year] ?? EMPTY
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage blocked: keep in memory */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Save answers for the year being worked on. */
export function setAnswers(patch: Partial<Answers>) {
  commit({ ...store, years: { ...store.years, [store.year]: { ...answers, ...patch } } })
}

/** Save one income follow-up answer. */
export function setDetail(id: string, value: string | string[]) {
  setAnswers({ details: { ...answers.details, [id]: value } })
}

/** Switch to another tax year (its own answers, kept separately). */
export function setFilingYear(year: number) {
  if (year !== store.year) commit({ ...store, year })
}

/** Answers for the year being worked on. */
export function useAnswers(): Answers {
  return useSyncExternalStore(subscribe, () => answers)
}

/** The tax year being worked on (TAX_YEAR unless a previous year was chosen on Home). */
export function useFilingYear(): number {
  return useSyncExternalStore(subscribe, () => store.year)
}

/** Every year's answers (Home shows which years are in progress). */
export function useAllReturns(): Record<string, Answers> {
  return useSyncExternalStore(subscribe, () => store.years)
}

/** True once anything has been answered for that year. */
export function hasProgress(a: Answers | undefined): boolean {
  return !!a && Object.values(a).some((v) => v !== undefined && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0))
}
