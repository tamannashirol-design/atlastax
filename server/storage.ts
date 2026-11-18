// Uploaded files and small per-session records, on disk under dataDir.
//
//   <dataDir>/files/<fileId>        the file itself
//   <dataDir>/files/<fileId>.json   who uploaded it, its name, size and type
//   <dataDir>/sessions/<id>.json    consent record
//
// Folders are private to this user (0700), files too (0600). Ids are random
// and checked against a strict pattern before they touch a path, so a request
// can never reach outside these folders. Production storage (encrypted, with
// a retention rule) is TODO with legal; this is the dev version.
import { randomUUID } from 'node:crypto'
import { createWriteStream, type WriteStream } from 'node:fs'
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type FileKind = 'pdf' | 'jpeg' | 'png' | 'heic' | 'webp'

export type FileMeta = {
  fileId: string
  sessionId: string
  /** The Documents item this file is for (e.g. "opt-cpt"), when known */
  itemId?: string
  /** The tax year it was uploaded for, when known */
  year?: number
  name: string
  size: number
  kind: FileKind
  createdAt: string
}

/** What a session agreed to: the notice version AND the fingerprint of the exact words shown, and when */
export type ConsentRecord = { version: string; fingerprint: string; at: string }

const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const isFileId = (id: string) => FILE_ID.test(id)

export function storage(dataDir: string) {
  const files = join(dataDir, 'files')
  const sessions = join(dataDir, 'sessions')
  const ready = Promise.all([mkdir(files, { recursive: true, mode: 0o700 }), mkdir(sessions, { recursive: true, mode: 0o700 })])

  return {
    filesDir: files,

    /** Every file a session has uploaded (dev storage: reads the records on disk). */
    async listFiles(sessionId: string): Promise<FileMeta[]> {
      await ready
      const out: FileMeta[] = []
      for (const f of await readdir(files)) {
        if (!f.endsWith('.json')) continue
        try {
          const m = JSON.parse(await readFile(join(files, f), 'utf8')) as FileMeta
          if (m.sessionId === sessionId) out.push(m)
        } catch {
          /* a record being written right now: skip */
        }
      }
      return out
    },

    /** A new file being written. Call keep() once it's complete and checked, or discard() to throw it away. */
    async begin(): Promise<{ fileId: string; stream: WriteStream; keep: (meta: Omit<FileMeta, 'fileId'>) => Promise<FileMeta>; discard: () => Promise<void> }> {
      await ready
      const fileId = randomUUID()
      const partial = join(files, `${fileId}.partial`)
      const stream = createWriteStream(partial, { mode: 0o600 })
      return {
        fileId,
        stream,
        keep: async (meta) => {
          const full = { fileId, ...meta }
          await writeFile(join(files, `${fileId}.json`), JSON.stringify(full), { mode: 0o600 })
          await rename(partial, join(files, fileId))
          return full
        },
        discard: async () => {
          stream.destroy()
          await rm(partial, { force: true })
        },
      }
    },

    async meta(fileId: string): Promise<FileMeta | null> {
      if (!isFileId(fileId)) return null
      try {
        return JSON.parse(await readFile(join(files, `${fileId}.json`), 'utf8')) as FileMeta
      } catch {
        return null
      }
    },

    /** Delete a file and its record. */
    async remove(fileId: string) {
      if (!isFileId(fileId)) return
      await rm(join(files, fileId), { force: true })
      await rm(join(files, `${fileId}.json`), { force: true })
    },

    /** True when neither the file nor its record is on the disk any more (checked on the disk itself, not in a list). */
    async gone(fileId: string): Promise<boolean> {
      if (!isFileId(fileId)) return true
      const there = (p: string) => access(p).then(() => true, () => false)
      return !(await there(join(files, fileId))) && !(await there(join(files, `${fileId}.json`)))
    },

    async consent(sessionId: string): Promise<ConsentRecord | null> {
      try {
        return (JSON.parse(await readFile(join(sessions, `${sessionId}.json`), 'utf8')) as { consent?: ConsentRecord }).consent ?? null
      } catch {
        return null
      }
    },

    async recordConsent(sessionId: string, record: ConsentRecord) {
      await ready
      await writeFile(join(sessions, `${sessionId}.json`), JSON.stringify({ consent: record }), { mode: 0o600 })
    },
  }
}

/** What a file really is, from its first bytes (never trust the name or the browser's type). */
export function sniff(head: Buffer): FileKind | null {
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg'
  if (head.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png'
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  if (/^ftyp(heic|heix|hevc|mif1|msf1)/.test(head.subarray(4, 12).toString('latin1'))) return 'heic'
  return null
}
