// The user's answers, remembered for this browser tab (so Back shows what you
// picked, and a reload doesn't lose your place). Falls back to memory only if
// the browser blocks storage.
import { useSyncExternalStore } from 'react'
import { TAX_YEAR } from '../config'

export type Answers = {
  visa?: 'F-1' | 'J-1' | 'M-1'
  enrolled?: 'yes' | 'no'
  state?: string // two-letter code
  taxId?: 'ssn' | 'itin' | 'none'
  filedBefore?: 'yes' | 'no'
  priorReturn?: 'skipped' | { fileName: string }
  citizenship?: string // two-letter region code
  income?: import('../data/income').IncomeId[]
  /** Income follow-up answers, keyed by screen id: a choice, an amount, file names, or "later" (skipped). */
  details?: Record<string, string | string[]>
  /** Status, arrival, years in the U.S. and days (src/residency). Travel history is sensitive: kept only here, in this tab. */
  residency?: ResidencyAnswers
  /**
   * The server's id for each uploaded file, keyed like the file names it
   * belongs to (an upload screen id, or 'cbp-history'), in the same order as
   * those names. Lets "Remove" delete the file from the server. Ids only:
   * no file contents and no extracted values are ever kept in the browser.
   * Managed only by UploadAnswer (rememberFileId / takeFileId).
   */
  fileIds?: Record<string, (string | null)[]>
}

export type ResidencyAnswers = {
  /** J-1 only: "Are you in the U.S. as a student?" (no = not supported yet) */
  j1Student?: 'yes' | 'no'
  /** First arrival in the U.S. as a student */
  arrivalYear?: number
  /** Asked only when the arrival year is one Form 8843 asks days for (YYYY-MM-DD) */
  arrivalDate?: string
  /** Asked only when arrival → tax year spans more than the student limit */
  yearAbroad?: 'yes' | 'no'
  abroadYears?: number[]
  /** "Did you leave the U.S. in …?" and the trips out */
  left?: 'yes' | 'no'
  trips?: import('../residency/days').AbroadTrip[]
  /** Optional: CBP travel history files (travel history is sensitive; kept only in this tab) */
  cbpFiles?: string[]
  historyCutOff?: boolean
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

/** Save time-in-the-U.S. answers (merged). */
export function setResidency(patch: Partial<ResidencyAnswers>) {
  setAnswers({ residency: { ...answers.residency, ...patch } })
}

/** Remove one income follow-up answer (e.g. undo "I'll add it later"). */
export function clearDetail(id: string) {
  const rest = { ...answers.details }
  delete rest[id]
  setAnswers({ details: rest })
}

/** Remember the server id of the file at position `index` in the list called `key`. */
export function rememberFileId(key: string, index: number, fileId: string) {
  const ids = [...(answers.fileIds?.[key] ?? [])]
  while (ids.length < index) ids.push(null) // files uploaded before ids were kept
  ids[index] = fileId
  setAnswers({ fileIds: { ...answers.fileIds, [key]: ids } })
}

/** Forget the id of the file at `index` (it's being removed) and return it, if known. */
export function takeFileId(key: string, index: number): string | undefined {
  const ids = [...(answers.fileIds?.[key] ?? [])]
  const [id] = ids.splice(index, 1)
  setAnswers({ fileIds: { ...answers.fileIds, [key]: ids } })
  return id ?? undefined
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
