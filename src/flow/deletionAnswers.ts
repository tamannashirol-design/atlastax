// The browser's copy of the answers after "Delete tax forms only" (see deletion.ts for what that covers). Pure.
import { DOCUMENT_RULES } from '../documents.config.ts'
import { TAX_FORM_ITEM_IDS } from './deletion.ts'

/** The part of the saved answers this touches (the full type lives in answers.ts) */
type Stored = { details?: Record<string, string | string[]>; fileIds?: Record<string, (string | null)[]>; reviewAt?: string }

/** The answers left after a deletion (the browser's copy of one year's answers). `everything` is handled by the store (no years left). */
export function answersAfterForms<A extends Stored>(a: A): A {
  const details = { ...a.details }
  const fileIds = { ...a.fileIds }
  for (const r of DOCUMENT_RULES) {
    delete details[r.uploadScreen]
    delete fileIds[r.uploadScreen]
  }
  const { reviewAt, ...rest } = a
  const keepAt = reviewAt && !TAX_FORM_ITEM_IDS.includes(reviewAt) ? { reviewAt } : {}
  return { ...rest, ...keepAt, details, fileIds } as A
}
