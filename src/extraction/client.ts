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
import { sessionReady } from '../lib/session'

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
  | { type: 'snapshot'; run: number; capabilities: { stages: boolean }; documents: DocumentReading[] }
  | { type: 'document'; run: number; document: DocumentReading }
  | { type: 'removed'; run: number; itemId: string }

const EMPTY: ExtractionState = { loaded: false, capabilities: { stages: true }, documents: {} }

/** run: the newest reading heard of; news from an earlier one (arriving late on the live connection) is ignored */
type Channel = { state: ExtractionState; run: number; listeners: Set<() => void>; source?: EventSource; opening?: boolean }
const channels = new Map<number, Channel>()

function channel(year: number): Channel {
  let c = channels.get(year)
  if (!c) channels.set(year, (c = { state: EMPTY, run: 0, listeners: new Set() }))
  return c
}

function apply(c: Channel, u: Update) {
  if (u.run < c.run) return
  c.run = u.run
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
  if (!c.source && !c.opening && typeof EventSource !== 'undefined') {
    // Wait for the session cookie first (see lib/session), then listen
    c.opening = true
    void sessionReady().then(() => {
      c.opening = false
      if (!c.listeners.size || c.source) return
      c.source = new EventSource(`/api/extraction/events?year=${year}`)
      c.source.onmessage = (e) => {
        try {
          apply(c, JSON.parse(e.data as string) as Update)
        } catch {
          /* ignore a malformed message */
        }
      }
    })
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

/**
 * The Reading page opened: ask the server to read every document from the beginning.
 * Its answer (everything queued) replaces what this tab knew, so an earlier reading
 * never shows as already done. Later changes arrive live.
 */
export async function startReading(year: number) {
  await sessionReady()
  const r = await fetch(`/api/extraction/start?year=${year}`, { method: 'POST' })
  if (!r.ok) throw new Error('start')
  apply(channel(year), (await r.json()) as Update)
}

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
  { id: 'fast', label: 'Fast (for automated checks)' },
  { id: 'one-fails', label: 'Next reading: one fails' },
  { id: 'wrong-type', label: 'Next reading: wrong form' },
  { id: 'blurry', label: 'Next reading: blurry' },
  { id: 'rotated', label: 'Next reading: sideways' },
  { id: 'all-fail', label: 'Everything fails' },
  { id: 'no-stages', label: 'No stages (skips “Extracting”)' },
  { id: 'low-confidence', label: 'Low confidence' },
] as const

/** Development only (/reading?reading=…): the mock's scenario for this visit to the Reading page. */
export const READING_SCENARIOS: Record<string, (typeof MOCK_SCENARIOS)[number]['id']> = {
  normal: 'normal',
  fail: 'one-fails',
  allfail: 'all-fail',
  wrongtype: 'wrong-type',
  blurry: 'blurry',
  rotated: 'rotated',
}

export async function setMockScenario(scenario: (typeof MOCK_SCENARIOS)[number]['id']) {
  const r = await fetch('/api/extraction/scenario', { method: 'POST', body: JSON.stringify({ scenario }) })
  return r.ok
}
