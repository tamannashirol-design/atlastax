// The Reading page's decisions, as pure functions (tested by `npm run check:reading`).
// No React, no network, no timers: ReadingPage.tsx and Home call these.
// The page shows one label: Reading your documents → Extracting your details → Done.
// Statuses come ONLY from the server's events (useExtraction); nothing here guesses progress.
import type { ExtractionState, Failure } from '../extraction/client.ts'
import { ITEM_FORMS } from '../extraction.config.ts'
import type { DocumentItem, RequiredItem } from '../flow/requiredDocuments.ts'

export type RowStatus = 'queued' | 'reading' | 'checking' | 'ready' | 'failed'
/** "missing": the document is added in the answers but the server has no file for it (e.g. added before files were kept) */
export type RowFailure = Failure | 'missing'

export type ReadingRow = {
  id: string
  /** What the row says: the form ("W-2"), or the fuller label when two rows would share a form name */
  name: string
  /** The form name, for messages ("This doesn't look like a W-2.") */
  form: string
  optional: boolean
  status: RowStatus
  failure?: RowFailure
}

/**
 *   empty           nothing to read: back to Documents
 *   working         something required is still waiting, being read or checked
 *   all-ready       every required document is ready: "Done", then on to Review by itself
 *   needs-continue  every required document has a result and at least one failed: wait for Continue
 *   all-failed      every required document failed: wait; Continue says "Enter them myself"
 * Optional documents never block: they show their status but don't hold the page.
 */
export type ReadingOutcome = 'empty' | 'working' | 'all-ready' | 'needs-continue' | 'all-failed'

export type ReadingOverview = {
  rows: ReadingRow[]
  total: number
  /** Anything (required or optional) still waiting or being read: drives the loops */
  running: boolean
  runningRequired: number
  failedRequired: number
  outcome: ReadingOutcome
}

/** After "Done" has settled, how long it stays before the page moves on to Review. */
export const DONE_HOLD_MS = 600

const RUNNING: RowStatus[] = ['queued', 'reading', 'checking']
export const isRunning = (s: RowStatus) => RUNNING.includes(s)
export const isReadable = (itemId: string) => itemId in ITEM_FORMS

/** The documents to read: every added document the reader knows (required and optional), in the order of requiredItems(). */
export function readingRows(items: RequiredItem[], ex: ExtractionState): ReadingRow[] {
  const docs = items.filter((i): i is DocumentItem => i.kind === 'document' && i.status === 'added' && isReadable(i.id))
  const shared = (form: string) => docs.filter((d) => d.form === form).length > 1
  return docs.map((d) => {
    const base = { id: d.id, name: shared(d.form) ? d.label : d.form, form: d.form, optional: !!d.optional }
    const r = ex.documents[d.id]
    if (!ex.loaded) return { ...base, status: 'queued' }
    if (!r) return { ...base, status: 'failed', failure: 'missing' }
    return r.status === 'failed' ? { ...base, status: 'failed', failure: r.failure ?? 'other' } : { ...base, status: r.status }
  })
}

export function readingOverview(items: RequiredItem[], ex: ExtractionState): ReadingOverview {
  const rows = readingRows(items, ex)
  const required = rows.some((r) => !r.optional) ? rows.filter((r) => !r.optional) : rows
  const runningRequired = required.filter((r) => isRunning(r.status)).length
  const failedRequired = required.filter((r) => r.status === 'failed').length
  const readyRequired = required.filter((r) => r.status === 'ready').length
  const outcome: ReadingOutcome =
    rows.length === 0
      ? 'empty'
      : runningRequired > 0
        ? 'working'
        : failedRequired === 0
          ? 'all-ready'
          : readyRequired === 0
            ? 'all-failed'
            : 'needs-continue'
  return { rows, total: rows.length, running: rows.some((r) => isRunning(r.status)), runningRequired, failedRequired, outcome }
}

/**
 * The one label on the page, in order: reading → extracting → done. "failed": every
 * required document has a result and something couldn't be read (wait for the person).
 * From the server's statuses only: "extracting" once nothing required is still waiting
 * or being read (all are being checked or finished). null: nothing to read.
 */
export type ReadingStage = 'reading' | 'extracting' | 'done' | 'failed'

export function readingStage(o: ReadingOverview): ReadingStage | null {
  if (o.outcome === 'empty') return null
  if (o.outcome === 'all-ready') return 'done'
  if (o.outcome === 'needs-continue' || o.outcome === 'all-failed') return 'failed'
  const required = o.rows.some((r) => !r.optional) ? o.rows.filter((r) => !r.optional) : o.rows
  return required.some((r) => r.status === 'queued' || r.status === 'reading') ? 'reading' : 'extracting'
}

export function stageLabel(stage: ReadingStage, o: Pick<ReadingOverview, 'failedRequired'>) {
  if (stage === 'failed') return `Couldn’t read ${o.failedRequired} ${o.failedRequired === 1 ? 'document' : 'documents'}`
  return STAGE_LABEL[stage]
}
export const STAGE_LABEL = { reading: 'Reading your documents', extracting: 'Extracting your details', done: 'Done' } as const

/** What a failed row says, and which button comes first: another try, or another file. */
export function failureCopy(row: Pick<ReadingRow, 'form' | 'failure'>): { message: string; first: 'retry' | 'replace' } {
  switch (row.failure) {
    case 'wrong-type':
      return { message: `This doesn’t look like a ${row.form}.`, first: 'replace' }
    case 'blurry':
      return { message: 'This photo is too blurry to read. A sharper photo in good light can help.', first: 'replace' }
    case 'rotated':
      return { message: 'This photo is sideways or upside down. Try one that’s upright.', first: 'replace' }
    case 'missing':
      return { message: 'We couldn’t find this file. Add it again.', first: 'replace' }
    default:
      return { message: 'We couldn’t read this one.', first: 'retry' }
  }
}

export const continueLabel = (o: Pick<ReadingOverview, 'outcome'>) => (o.outcome === 'all-failed' ? 'Enter them myself' : 'Continue')

/** "passport", "most recent I-94", but "W-2" and "1042-S" as they are */
const spoken = (form: string) => (/^[A-Z][a-z]/.test(form) ? form[0].toLowerCase() + form.slice(1) : form)

/**
 * What the live region says for REAL changes (never on the first look, never for loop
 * ticks): each new stage by its label, and each document that couldn't be read.
 */
export function announcements(prev: { stage: ReadingStage | null; rows: ReadingRow[] } | null, next: { stage: ReadingStage | null; rows: ReadingRow[] }): string[] {
  if (!prev) return []
  const out: string[] = []
  if (next.stage && next.stage !== 'failed' && next.stage !== prev.stage) out.push(STAGE_LABEL[next.stage])
  const was = new Map(prev.rows.map((r) => [r.id, r.status]))
  for (const r of next.rows) if (r.status === 'failed' && was.get(r.id) !== 'failed') out.push(`Couldn’t read your ${spoken(r.name)}`)
  return out
}

/**
 * Home after a reading where something couldn't be read: "1 document couldn't be read" /
 * See what happened (to /reading). null = no change to Home (nothing read yet, still
 * reading, or everything read).
 */
export function homeReadingState(o: ReadingOverview | null): null | { state: 'reading-failed'; headline: string; sentence: string; buttonLabel: string } {
  if (!o || o.runningRequired > 0 || o.failedRequired === 0) return null
  return {
    state: 'reading-failed',
    headline: `${o.failedRequired} ${o.failedRequired === 1 ? 'document' : 'documents'} couldn’t be read`,
    sentence: 'You can try again, add another file, or enter the details yourself.', // TODO confirm copy
    buttonLabel: 'See what happened', // TODO confirm copy
  }
}

/** A short signature of the rows, to notice real changes cheaply */
export const rowsSignature = (rows: ReadingRow[]) => rows.map((r) => `${r.id}:${r.status}:${r.failure ?? ''}`).join('|')
