// Review in the browser: loads the documents to check from our server and saves
// every change as it happens (no Save button). ID numbers arrive masked; the full
// value comes only from reveal() (Show) and lives in the screen's state until it
// closes. Nothing here is written to browser storage.
//
// Dev: ?review=needs|ticked|failed|wrongtype|replace|summary shows fixed sample
// documents instead (nothing sent to the server); see fixtures.ts.
import { useSyncExternalStore } from 'react'
import { sessionReady } from '../lib/session'
import type { FieldPatch, ReviewDoc } from './logic'

type State = { loaded: boolean; failed: boolean; docs: Record<string, ReviewDoc> }
type Backend = {
  list: () => Promise<ReviewDoc[]>
  save: (itemId: string, body: { fields?: Record<string, FieldPatch>; status?: ReviewDoc['status']; manual?: boolean }) => Promise<ReviewDoc | 'not-done'>
  reveal: (itemId: string, key: string) => Promise<string>
}

function server(year: number): Backend {
  return {
    async list() {
      await sessionReady()
      const r = await fetch(`/api/review?year=${year}`)
      if (!r.ok) throw new Error('review')
      return ((await r.json()) as { documents: ReviewDoc[] }).documents
    },
    async save(itemId, body) {
      const r = await fetch(`/api/review/${encodeURIComponent(itemId)}?year=${year}`, { method: 'PUT', body: JSON.stringify(body) })
      if (r.status === 409) return 'not-done'
      if (!r.ok) throw new Error('save')
      return (await r.json()) as ReviewDoc
    },
    async reveal(itemId, key) {
      const r = await fetch(`/api/review/${encodeURIComponent(itemId)}/reveal?year=${year}&key=${encodeURIComponent(key)}`)
      if (!r.ok) throw new Error('reveal')
      return ((await r.json()) as { value: string }).value
    },
  }
}

let state: State = { loaded: false, failed: false, docs: {} }
let backend: Backend | null = null
let backendKey = ''
const listeners = new Set<() => void>()
const set = (s: State) => {
  state = s
  listeners.forEach((l) => l())
}

/** Use the server for this year, or a dev fixture backend (fixtures.ts). */
export function useReviewBackend(key: string, make: () => Backend | null) {
  if (key !== backendKey) {
    backendKey = key
    backend = make()
    state = { loaded: false, failed: false, docs: {} }
  }
}
export const serverBackend = server

export async function refreshReview() {
  if (!backend) return
  try {
    const docs = await backend.list()
    set({ loaded: true, failed: false, docs: Object.fromEntries(docs.map((d) => [d.itemId, d])) })
  } catch {
    set({ ...state, loaded: true, failed: true })
  }
}

/** Save one change. Returns false when it couldn't be saved (the screen says so). */
export async function saveReview(itemId: string, body: Parameters<Backend['save']>[1]): Promise<boolean | 'not-done'> {
  if (!backend) return false
  try {
    const doc = await backend.save(itemId, body)
    if (doc === 'not-done') return 'not-done'
    set({ ...state, docs: { ...state.docs, [itemId]: doc } })
    return true
  } catch {
    return false
  }
}

export async function revealValue(itemId: string, key: string): Promise<string | null> {
  try {
    return backend ? await backend.reveal(itemId, key) : null
  } catch {
    return null
  }
}

export function useReviewState(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export type { Backend }
