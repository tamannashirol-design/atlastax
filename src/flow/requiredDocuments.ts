// The ONE function that turns the income answers into what someone needs to
// provide. Home, the Documents page, the stepper and the flow's upload
// questions all call it; the rules live in src/documents.config.ts.
// Pure (no React), so scripts/check-documents.ts can test it.
//
// Two kinds of items:
//   document  a form is expected (upload it, or defer: "I'll add it later" /
//             "I don't have this", on the Documents page)
//   income    self-reported: the income is registered but no form came
//             ("No, I didn't get one" where the config allows it). Needs
//             details, unless deferred with "I'll add it later".
// Picking an income card always registers the income, whatever the form answer.
import { DOCUMENT_RULES, IDENTITY_DOCUMENTS, type DocumentRule, type IdentityRule } from '../documents.config.ts'
import type { IncomeId } from '../data/income.ts'
import type { Answers } from './answers.ts'
import { isSupportedStudent } from '../residency/fromAnswers.ts'

/** added · later ("I'll add it later") · none ("I don't have this", Documents page) · missing. later and none are deferred. */
export type DocumentStatus = 'added' | 'later' | 'none' | 'missing'
/** details-needed · later ("I'll add it later") · provided (once details collection exists; TODO confirm with CPA) */
export type IncomeItemStatus = 'details-needed' | 'later' | 'provided'

/** group: "identity" (e.g. the I-94, needed by everyone with a supported status) or "income" */
export type DocumentItem = (DocumentRule | (IdentityRule & Partial<Record<keyof Omit<DocumentRule, keyof IdentityRule>, undefined>>)) & {
  kind: 'document'
  group: 'identity' | 'income'
  /** Listed but not counted, never holds anything up (e.g. a state ID) */
  optional?: boolean
  status: DocumentStatus
  files: string[]
}
export type IncomeItem = DocumentRule & { kind: 'income'; status: IncomeItemStatus }
export type RequiredItem = DocumentItem | IncomeItem

/** Answer stored when an upload question is skipped */
export type SkipValue = 'later' | 'none'

/** Where a self-reported item's state is saved (answers.details), e.g. "self-report:freelance" = "later" */
export const selfReportKey = (ruleId: string) => `self-report:${ruleId}`

const statusOf = (files: string[], v: unknown): DocumentStatus => (files.length ? 'added' : v === 'later' ? 'later' : v === 'none' ? 'none' : 'missing')

/** Everything these answers call for: identity documents first, then income in income-card order. */
export function requiredItems(a: Answers): RequiredItem[] {
  const supported = isSupportedStudent(a)
  const identity: RequiredItem[] = supported
    ? IDENTITY_DOCUMENTS.map((r) => {
        const v = a.details?.[r.uploadScreen]
        const files = Array.isArray(v) ? v : []
        return { ...r, kind: 'document', group: 'identity', status: statusOf(files, v), files }
      })
    : []
  return identity.concat(incomeItems(a))
}

function incomeItems(a: Answers): RequiredItem[] {
  return DOCUMENT_RULES.filter((r) => a.income?.includes(r.income)).map((r): RequiredItem => {
    const saidNoForm = !!r.formQuestion && a.details?.[r.formQuestion] === 'no'
    if (saidNoForm && r.reportableWithoutForm) {
      const v = a.details?.[selfReportKey(r.id)]
      return { ...r, kind: 'income', status: v === 'later' ? 'later' : v === 'provided' ? 'provided' : 'details-needed' }
    }
    // A form is expected (including before the form question is answered)
    const v = a.details?.[r.uploadScreen]
    const files = Array.isArray(v) ? v : []
    return { ...r, kind: 'document', group: 'income', status: statusOf(files, v), files }
  })
}

export const isDeferred = (s: DocumentStatus | IncomeItemStatus) => s === 'later' || s === 'none'

export type ItemsSummary = {
  documents: { total: number; added: number; deferred: number; missing: number }
  income: { total: number; needsDetails: number; deferred: number; provided: number }
  /** Nothing outstanding: every document added or deferred, every self-reported item provided or deferred */
  done: boolean
}

/** Counts for Home, the Documents page and the stepper (documents and income items counted separately). */
export function summarizeItems(items: RequiredItem[]): ItemsSummary {
  // Optional documents (e.g. a state ID) are listed but never counted
  const docs = items.filter((i): i is DocumentItem => i.kind === 'document' && !i.optional)
  const income = items.filter((i): i is IncomeItem => i.kind === 'income')
  const added = docs.filter((d) => d.status === 'added').length
  const docDeferred = docs.filter((d) => isDeferred(d.status)).length
  const needsDetails = income.filter((i) => i.status === 'details-needed').length
  const incomeDeferred = income.filter((i) => i.status === 'later').length
  // Skipped documents ("later" / "none") still count as missing: every required
  // document is needed to prepare the return, so they keep Continue locked.
  const missing = docs.length - added
  return {
    documents: { total: docs.length, added, deferred: docDeferred, missing },
    income: { total: income.length, needsDetails, deferred: incomeDeferred, provided: income.length - needsDetails - incomeDeferred },
    done: missing === 0 && needsDetails === 0,
  }
}

/** The stepper's Documents section, Home and the flow use this one answer. */
export const documentsDone = (a: Answers) => summarizeItems(requiredItems(a)).done

/** Link to one item on the Documents page. */
export const documentHref = (itemId: string) => `/documents#item-${itemId}`

/** "2 of 3 documents added" (documents only), or "No documents needed yet". Same words everywhere. */
export function documentsLine(s: ItemsSummary): string {
  const { total, added } = s.documents
  if (total === 0) return 'No documents needed yet'
  return `${added} of ${total} ${total === 1 ? 'document' : 'documents'} added`
}

/** "1 income item needs details", or null when none do. */
export function incomeItemsLine(s: ItemsSummary): string | null {
  const n = s.income.needsDetails
  return n === 0 ? null : `${n} income ${n === 1 ? 'item needs' : 'items need'} details`
}

/** Does the flow show this upload question? Only when a form is expected for it. */
export function uploadScreenApplies(uploadScreen: string, a: Answers): boolean {
  return requiredItems(a).some((i) => i.kind === 'document' && i.uploadScreen === uploadScreen)
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
