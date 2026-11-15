// Reading status in the browser (EXTRACTION-PLAN.md). Talks to our server only;
// the browser never reads files itself (D3) and never receives extracted
// values here, only statuses.
//
// One live connection per tax year (server-sent events), shared by every
// component that asks, opened while at least one is on screen. A status
// changes ONLY when the server reports a change (D7): no timers here.
// The connection reconnects by itself, and the server sends the full state
// again on every (re)connect.
import { useSyncExternalStore } from 'react'
import { useFilingYear } from '../flow/answers'

export type ReadingStatus = 'queued' | 'reading' | 'checking' | 'ready' | 'failed'
export type Failure = 'unreadable' | 'wrong-type' | 'blurry' | 'rotated' | 'other'
export type DocumentReading = { itemId: string; status: ReadingStatus; failure?: Failure; files: number }

export type ExtractionState = {
  /** false until the server's first answer */
  loaded: boolean
  /** Can the provider say "checking"? (EXTRACTION-PLAN.md, Reading page §2) */
  capabilities: { stages: boolean }
  documents: Record<string, DocumentReading>
}

type Update =
  | { type: 'snapshot'; capabilities: { stages: boolean }; documents: DocumentReading[] }
  | { type: 'document'; document: DocumentReading }
  | { type: 'removed'; itemId: string }

const EMPTY: ExtractionState = { loaded: false, capabilities: { stages: true }, documents: {} }

type Channel = { state: ExtractionState; listeners: Set<() => void>; source?: EventSource }
const channels = new Map<number, Channel>()

function channel(year: number): Channel {
  let c = channels.get(year)
  if (!c) channels.set(year, (c = { state: EMPTY, listeners: new Set() }))
  return c
}

function apply(c: Channel, u: Update) {
  const s = c.state
  if (u.type === 'snapshot') c.state = { loaded: true, capabilities: u.capabilities, documents: Object.fromEntries(u.documents.map((d) => [d.itemId, d])) }
  else if (u.type === 'document') c.state = { ...s, documents: { ...s.documents, [u.document.itemId]: u.document } }
  else {
    const documents = { ...s.documents }
    delete documents[u.itemId]
    c.state = { ...s, documents }
  }
  c.listeners.forEach((l) => l())
}

function subscribe(year: number, listener: () => void) {
  const c = channel(year)
  c.listeners.add(listener)
  if (!c.source && typeof EventSource !== 'undefined') {
    c.source = new EventSource(`/api/extraction/events?year=${year}`)
    c.source.onmessage = (e) => {
      try {
        apply(c, JSON.parse(e.data as string) as Update)
      } catch {
        /* ignore a malformed message */
      }
    }
  }
  return () => {
    c.listeners.delete(listener)
    if (!c.listeners.size) {
      c.source?.close()
      c.source = undefined
    }
  }
}

/** Reading status for the tax year being worked on, live. */
export function useExtraction(): ExtractionState {
  const year = useFilingYear()
  return useSyncExternalStore(
    (l) => subscribe(year, l),
    () => channel(year).state,
  )
}

/** "In progress" for people: waiting its turn, being read or being checked. */
export const isReading = (d: DocumentReading | undefined) => !!d && (d.status === 'queued' || d.status === 'reading' || d.status === 'checking')

/** Try reading a document again (after "Couldn't read"). */
export async function retryReading(year: number, itemId: string) {
  await fetch(`/api/extraction/${encodeURIComponent(itemId)}/retry?year=${year}`, { method: 'POST' })
}

/** Delete an uploaded file from the server ("Remove"). Reading restarts with any files left. */
export async function deleteFile(fileId: string) {
  await fetch(`/api/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }).catch(() => {
    /* offline: the file stays on the server; TODO retry queue before launch */
  })
}

/** Development only: what the mock provider does next (/motion). */
export const MOCK_SCENARIOS = [
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
  { id: 'slow', label: 'Slow (over a minute)' },
  { id: 'one-fails', label: 'Next upload fails' },
  { id: 'wrong-type', label: 'Next upload: wrong form' },
  { id: 'blurry', label: 'Next upload: blurry' },
  { id: 'rotated', label: 'Next upload: sideways' },
  { id: 'all-fail', label: 'Everything fails' },
  { id: 'no-stages', label: 'No stages' },
  { id: 'low-confidence', label: 'Low confidence' },
] as const

export async function setMockScenario(scenario: (typeof MOCK_SCENARIOS)[number]['id']) {
  const r = await fetch('/api/extraction/scenario', { method: 'POST', body: JSON.stringify({ scenario }) })
  return r.ok
}
