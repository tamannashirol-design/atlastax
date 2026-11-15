// The consent notice as the server knows it: its words, version and fingerprint.
// The fingerprint is a short hash of the exact words, so a record can prove which
// text was agreed to (src/consent.config.ts, EXTRACTION-PLAN.md §4).
import { createHash } from 'node:crypto'

export type Notice = { version: string; fingerprint: string; copy: unknown }
export type NoticeId = { version: string; fingerprint: string }

/** First 12 characters of the SHA-256 of the words (JSON). */
export const fingerprintOf = (copy: unknown) => createHash('sha256').update(JSON.stringify(copy)).digest('hex').slice(0, 12)
