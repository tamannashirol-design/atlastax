// Reading jobs: one per document (person + tax year + Documents item).
//
// - Reading starts as soon as a file is uploaded (D4). Adding, replacing or
//   removing a file restarts that document's reading with all its files;
//   removing the last file drops the document.
// - The browser listens per tax year and gets a small status update on every
//   real change. Updates carry statuses only, never values (D3, D9).
// - State is kept in memory. After a server restart, the files on disk are
//   read again automatically the next time the browser asks (trigger "resume").
// - Extracted fields stay here for the Review screen (build step 6).
import { join } from 'node:path'
import { FIELDS, ITEM_FORMS } from '../../src/extraction.config.ts'
import type { FileMeta } from '../storage.ts'
import type { ExtractedField, ExtractionProvider, Failure, ReadInput } from './provider.ts'

export type ReadingStatus = 'queued' | 'reading' | 'checking' | 'ready' | 'failed'

/** What the browser sees for one document */
export type DocumentReading = { itemId: string; status: ReadingStatus; failure?: Failure; files: number }

export type ExtractionUpdate =
  | { type: 'snapshot'; capabilities: { stages: boolean }; documents: DocumentReading[] }
  | { type: 'document'; document: DocumentReading }
  | { type: 'removed'; itemId: string }

type Doc = DocumentReading & { run: number; abort?: AbortController; fields?: ExtractedField[] }

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
  const keyOf = (sessionId: string, year: number) => `${sessionId}:${year}`
  const docsOf = (key: string) => docs.get(key) ?? docs.set(key, new Map()).get(key)!
  const pub = ({ itemId, status, failure, files }: Doc): DocumentReading => ({ itemId, status, files, ...(failure ? { failure } : {}) })
  const emit = (key: string, u: ExtractionUpdate) => listeners.get(key)?.forEach((l) => l(u))

  async function filesFor(sessionId: string, year: number, itemId: string) {
    return (await listFiles(sessionId)).filter((m) => m.year === year && m.itemId === itemId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async function start(sessionId: string, year: number, itemId: string, trigger: ReadInput['trigger']) {
    const key = keyOf(sessionId, year)
    const map = docsOf(key)
    const files = await filesFor(sessionId, year, itemId)
    const old = map.get(itemId)
    old?.abort?.abort()
    if (!files.length) {
      if (old) {
        map.delete(itemId)
        emit(key, { type: 'removed', itemId })
      }
      return
    }
    const doc: Doc = { itemId, status: 'queued', files: files.length, run: (old?.run ?? 0) + 1, abort: new AbortController() }
    map.set(itemId, doc)
    emit(key, { type: 'document', document: pub(doc) })

    const update = (patch: Partial<Doc>) => {
      if (map.get(itemId) !== doc) return false // a newer read took over
      Object.assign(doc, patch)
      emit(key, { type: 'document', document: pub(doc) })
      return true
    }
    try {
      const forms = ITEM_FORMS[itemId]
      for await (const e of providerFor(sessionId).read({ files: files.map((f) => join(filesDir, f.fileId)), forms, fieldsFor: (f) => FIELDS[f], trigger, signal: doc.abort!.signal })) {
        if (e.type === 'stage' && !update({ status: e.stage })) return
        if (e.type === 'failed' && !update({ status: 'failed', failure: e.reason, abort: undefined })) return
        if (e.type === 'result' && !update({ status: 'ready', fields: e.fields, abort: undefined })) return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('[extraction] read failed:', (err as NodeJS.ErrnoException).code ?? 'error')
      update({ status: 'failed', failure: 'other', abort: undefined })
    }
  }

  return {
    /** A file was added or removed for this document: (re)start reading it. */
    filesChanged(sessionId: string, year: number | undefined, itemId: string | undefined) {
      if (year === undefined || !isReadable(itemId)) return
      void start(sessionId, year, itemId, 'upload')
    },

    retry(sessionId: string, year: number, itemId: string) {
      if (!isReadable(itemId)) return false
      const doc = docs.get(keyOf(sessionId, year))?.get(itemId)
      if (!doc) return false
      void start(sessionId, year, itemId, 'retry')
      return true
    },

    /** Current state for this person and year; catches up on files nobody is reading yet (after a restart). */
    async snapshot(sessionId: string, year: number): Promise<ExtractionUpdate> {
      const key = keyOf(sessionId, year)
      const map = docsOf(key)
      const items = new Set((await listFiles(sessionId)).filter((m) => m.year === year && isReadable(m.itemId)).map((m) => m.itemId!))
      for (const itemId of items) if (!map.has(itemId)) void start(sessionId, year, itemId, 'resume')
      // start() registers the doc synchronously only after awaiting files; show "queued" for those meanwhile
      const documents = [...items].map((itemId) => (map.get(itemId) ? pub(map.get(itemId)!) : { itemId, status: 'queued' as const, files: 0 }))
      return { type: 'snapshot', capabilities: providerFor(sessionId).capabilities(), documents }
    },

    listen(sessionId: string, year: number, on: (u: ExtractionUpdate) => void) {
      const key = keyOf(sessionId, year)
      const set = listeners.get(key) ?? listeners.set(key, new Set()).get(key)!
      set.add(on)
      return () => set.delete(on)
    },

    /** Extracted fields for the Review screen (step 6). Server-side only. */
    fields(sessionId: string, year: number, itemId: string) {
      return docs.get(keyOf(sessionId, year))?.get(itemId)?.fields ?? null
    },
  }
}
