// Reading jobs: one per document (person + tax year + Documents item).
//
// - Reading starts only when the Reading page asks (start: every document with
//   files, read again from the beginning, so the page always plays it through).
//   Adding, replacing or removing a file makes an earlier reading out of date:
//   it stops and is dropped, until the next start.
// - The browser listens per tax year and gets a small status update on every
//   real change. Updates carry statuses only, never values (D3, D9).
// - State is kept in memory. After a server restart nothing has been read
//   until the Reading page starts it again.
// - Extracted fields stay here for the Review screen (build step 6).
import { join } from 'node:path'
import { FIELDS, ITEM_FORMS, type FormType } from '../../src/extraction.config.ts'
import type { FileMeta } from '../storage.ts'
import type { ExtractedField, ExtractionProvider, Failure, ReadInput } from './provider.ts'

export type ReadingStatus = 'queued' | 'reading' | 'checking' | 'ready' | 'failed'

/** What the browser sees for one document */
export type DocumentReading = { itemId: string; status: ReadingStatus; failure?: Failure; files: number }

/** `run`: which reading this belongs to (+1 on every start), so the browser can ignore late news from an earlier one */
export type ExtractionUpdate =
  | { type: 'snapshot'; run: number; capabilities: { stages: boolean }; documents: DocumentReading[] }
  | { type: 'document'; run: number; document: DocumentReading }
  | { type: 'removed'; run: number; itemId: string }

type Doc = DocumentReading & { run: number; abort?: AbortController; fields?: ExtractedField[]; form?: FormType }

type Deps = {
  /** The provider for a session (the mock's scenario is per session) */
  providerFor: (sessionId: string) => ExtractionProvider
  filesDir: string
  /** Every file this session has uploaded (from storage) */
  listFiles: (sessionId: string) => Promise<FileMeta[]>
}

/** Documents that are read (the optional ones and travel history aren't, for now) */
export const isReadable = (itemId: string | undefined): itemId is string => !!itemId && itemId in ITEM_FORMS

export function readingJobs({ providerFor, filesDir, listFiles }: Deps) {
  const docs = new Map<string, Map<string, Doc>>() // "<session>:<year>" → itemId → doc
  const listeners = new Map<string, Set<(u: ExtractionUpdate) => void>>()
  const runs = new Map<string, number>() // "<session>:<year>" → current run
  const keyOf = (sessionId: string, year: number) => `${sessionId}:${year}`
  const runOf = (key: string) => runs.get(key) ?? 0
  const docsOf = (key: string) => docs.get(key) ?? docs.set(key, new Map()).get(key)!
  const pub = ({ itemId, status, failure, files }: Doc): DocumentReading => ({ itemId, status, files, ...(failure ? { failure } : {}) })
  const emit = (key: string, u: ExtractionUpdate) => listeners.get(key)?.forEach((l) => l(u))

  async function filesFor(sessionId: string, year: number, itemId: string) {
    return (await listFiles(sessionId)).filter((m) => m.year === year && m.itemId === itemId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** Optional hook: a document's files changed (Review clears its checks) */
  let onFilesChanged: (sessionId: string, year: number, itemId: string) => void = () => {}

  /** Mark a document "queued" (synchronously visible to snapshots) and read it in the background. */
  async function start(sessionId: string, year: number, itemId: string, trigger: ReadInput['trigger']) {
    const key = keyOf(sessionId, year)
    const map = docsOf(key)
    const files = await filesFor(sessionId, year, itemId)
    const old = map.get(itemId)
    old?.abort?.abort()
    if (!files.length) {
      if (old) {
        map.delete(itemId)
        emit(key, { type: 'removed', run: runOf(key), itemId })
      }
      return
    }
    const doc: Doc = { itemId, status: 'queued', files: files.length, run: (old?.run ?? 0) + 1, abort: new AbortController() }
    map.set(itemId, doc)
    emit(key, { type: 'document', run: runOf(key), document: pub(doc) })
    void read(key, map, doc, files, trigger, sessionId)
  }

  async function read(key: string, map: Map<string, Doc>, doc: Doc, files: FileMeta[], trigger: ReadInput['trigger'], sessionId: string) {
    const update = (patch: Partial<Doc>) => {
      if (map.get(doc.itemId) !== doc) return false // a newer read took over
      Object.assign(doc, patch)
      emit(key, { type: 'document', run: runOf(key), document: pub(doc) })
      return true
    }
    try {
      const forms = ITEM_FORMS[doc.itemId]
      for await (const e of providerFor(sessionId).read({ files: files.map((f) => join(filesDir, f.fileId)), forms, fieldsFor: (f) => FIELDS[f], trigger, signal: doc.abort!.signal })) {
        if (e.type === 'stage' && !update({ status: e.stage })) return
        if (e.type === 'failed' && !update({ status: 'failed', failure: e.reason, abort: undefined })) return
        if (e.type === 'result' && !update({ status: 'ready', fields: e.fields, form: e.form, abort: undefined })) return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('[extraction] read failed:', (err as NodeJS.ErrnoException).code ?? 'error')
      update({ status: 'failed', failure: 'other', abort: undefined })
    }
  }

  const readableItems = async (sessionId: string, year: number) =>
    new Set((await listFiles(sessionId)).filter((m) => m.year === year && isReadable(m.itemId)).map((m) => m.itemId!))

  function snapshotOf(sessionId: string, year: number): ExtractionUpdate {
    const documents = [...docsOf(keyOf(sessionId, year)).values()].map(pub)
    return { type: 'snapshot', run: runOf(keyOf(sessionId, year)), capabilities: providerFor(sessionId).capabilities(), documents }
  }

  return {
    /** A file was added or removed: any reading of this document is out of date. Stop it and drop it. */
    filesChanged(sessionId: string, year: number | undefined, itemId: string | undefined) {
      if (year === undefined || !isReadable(itemId)) return
      onFilesChanged(sessionId, year, itemId)
      const key = keyOf(sessionId, year)
      const map = docsOf(key)
      const old = map.get(itemId)
      if (!old) return
      old.abort?.abort()
      map.delete(itemId)
      emit(key, { type: 'removed', run: runOf(key), itemId })
    },

    /** The Reading page opened: read every document of this person and year from the beginning. Returns the state with all of them queued. */
    async start(sessionId: string, year: number) {
      const key = keyOf(sessionId, year)
      runs.set(key, runOf(key) + 1)
      const items = await readableItems(sessionId, year)
      const map = docsOf(key)
      // Documents whose files are gone since the last reading
      for (const itemId of [...map.keys()]) if (!items.has(itemId)) this.filesChanged(sessionId, year, itemId)
      await Promise.all([...items].map((itemId) => start(sessionId, year, itemId, 'start')))
      return snapshotOf(sessionId, year)
    },

    /** "Try again", or a new file chosen on the Reading page: read this one document from the beginning. */
    async retry(sessionId: string, year: number, itemId: string) {
      if (!isReadable(itemId)) return false
      if (!(await filesFor(sessionId, year, itemId)).length) return false
      await start(sessionId, year, itemId, 'retry')
      return true
    },

    /** Current state for this person and year (only what has been started). */
    snapshot(sessionId: string, year: number): ExtractionUpdate {
      return snapshotOf(sessionId, year)
    },

    listen(sessionId: string, year: number, on: (u: ExtractionUpdate) => void) {
      const key = keyOf(sessionId, year)
      const set = listeners.get(key) ?? listeners.set(key, new Set()).get(key)!
      set.add(on)
      return () => set.delete(on)
    },

    /** The latest reading of a document, with its fields, for Review. Server-side only: values never go out as they are. */
    reading(sessionId: string, year: number, itemId: string) {
      const d = docs.get(keyOf(sessionId, year))?.get(itemId)
      return d ? { status: d.status, failure: d.failure, form: d.form, fields: d.fields ?? null } : null
    },

    /** Does this person have files for this document? */
    async hasFiles(sessionId: string, year: number, itemId: string) {
      return (await filesFor(sessionId, year, itemId)).length > 0
    },

    whenFilesChange(fn: typeof onFilesChanged) {
      onFilesChanged = fn
    },
  }
}
