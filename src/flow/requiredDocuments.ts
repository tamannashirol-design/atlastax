// The ONE function that turns the income answers into the documents someone
// needs. Home, the Documents page, the stepper and the flow's upload questions
// all call this; the rules themselves live in src/documents.config.ts.
// Pure (no React), so scripts/check-documents.ts can test it.
import { DOCUMENT_RULES, type DocumentRule } from '../documents.config.ts'
import type { IncomeId } from '../data/income.ts'
import type { Answers } from './answers.ts'

/**
 * added   at least one file uploaded
 * later   "I'll add it later" (deferred)
 * none    "I didn't get one" / "I didn't get a form" (deferred: "I don't have this")
 * missing nothing yet
 */
export type DocumentStatus = 'added' | 'later' | 'none' | 'missing'
export type RequiredDocument = DocumentRule & { status: DocumentStatus; files: string[] }

/** Answer stored when an upload question is skipped */
export type SkipValue = 'later' | 'none'

const ruleApplies = (r: DocumentRule, a: Answers) => !!a.income?.includes(r.income) && (!r.onlyIf || a.details?.[r.onlyIf.screen] === r.onlyIf.answer)

/** The documents these answers call for, in income-card order, each with its status. */
export function requiredDocuments(a: Answers): RequiredDocument[] {
  return DOCUMENT_RULES.filter((r) => ruleApplies(r, a)).map((r) => {
    const v = a.details?.[r.uploadScreen]
    const files = Array.isArray(v) ? v : []
    const status: DocumentStatus = files.length ? 'added' : v === 'later' ? 'later' : v === 'none' ? 'none' : 'missing'
    return { ...r, status, files }
  })
}

export const isDeferred = (s: DocumentStatus) => s === 'later' || s === 'none'

export type DocumentsSummary = { total: number; added: number; deferred: number; missing: number; done: boolean }

/** Counts for Home and the stepper. done = nothing missing (every document added or deferred). */
export function summarizeDocuments(docs: RequiredDocument[]): DocumentsSummary {
  const added = docs.filter((d) => d.status === 'added').length
  const deferred = docs.filter((d) => isDeferred(d.status)).length
  const missing = docs.length - added - deferred
  return { total: docs.length, added, deferred, missing, done: missing === 0 }
}

/** Is the document behind this upload screen needed? (The flow shows the upload question only then.) */
export function uploadScreenApplies(uploadScreen: string, a: Answers): boolean {
  return DOCUMENT_RULES.some((r) => r.uploadScreen === uploadScreen && ruleApplies(r, a))
}

/** The rule behind an upload screen (the flow uses its form name). */
export function ruleForUploadScreen(uploadScreen: string): DocumentRule {
  const r = DOCUMENT_RULES.find((x) => x.uploadScreen === uploadScreen)
  if (!r) throw new Error(`No document rule for upload screen "${uploadScreen}"`)
  return r
}

/** Form code shown under an income card's label, if one form clearly applies. */
export function incomeCardForm(income: IncomeId): string | undefined {
  return DOCUMENT_RULES.find((r) => r.income === income && r.showOnIncomeCard)?.form
}
