// The swappable reader (EXTRACTION-PLAN.md §2). Every provider, mock or real,
// looks like this to the rest of the server. Pick one in server/config.ts.
import type { FieldKind, FieldSpec, FormType } from '../../src/extraction.config.ts'
import type { SensitiveId } from '../../src/lib/mask.ts'

export type Stage = 'reading' | 'checking'
export type Failure = 'unreadable' | 'wrong-type' | 'blurry' | 'rotated' | 'other'
export type Confidence = 'high' | 'low' | 'missing'

/** One detail read from a document (EXTRACTION-PLAN.md §3). Stays on the server. */
export type ExtractedField = {
  key: string
  label: string
  box?: string
  kind: FieldKind
  sensitive?: SensitiveId
  needsTick: boolean
  /** What the provider read (null = not found) */
  suggested: string | null
  confidence: Confidence
  /** What the person confirmed or typed (Review screen, later). Never pre-filled. */
  value: string | null
  source: 'suggested' | 'edited' | 'typed'
}

export type ProviderEvent =
  | { type: 'stage'; stage: Stage }
  | { type: 'result'; form: FormType; fields: ExtractedField[] }
  | { type: 'failed'; reason: Failure }

export type ReadInput = {
  /** Paths of the document's files on disk (a document can have several) */
  files: string[]
  /** The forms this document may be (from extraction.config.ts ITEM_FORMS) */
  forms: FormType[]
  /** Fields to read for each possible form */
  fieldsFor: (form: FormType) => FieldSpec[]
  /** Why this read started: the Reading page opened, or "Try again" */
  trigger: 'start' | 'retry'
  /** Aborted when the document changes (new file, removed file, retry, a new start): stop at once */
  signal: AbortSignal
}

export interface ExtractionProvider {
  name: string
  /** What it can report; the browser adapts (no "Checking" without stages). */
  capabilities: () => { stages: boolean }
  /** Read one document. Yields real progress as it happens, then a result or a failure. */
  read(input: ReadInput): AsyncIterable<ProviderEvent>
}
