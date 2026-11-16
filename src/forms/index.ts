// The downloads: one function that, from the confirmed values, the estimate and the facts, says for each
// form whether it can be prepared, and if so exactly what goes in it. Pure: no PDF, no network, no files.
// The server turns a ready FormFill into a PDF (server/forms.ts), in memory, per request.
import { isCalculated, type Estimate, type FormStatus } from '../tax/estimate.ts'
import type { ConfirmedDocument, TaxInput } from '../tax/input.ts'
import { build1040NR } from './map-1040nr.ts'
import { build8843 } from './map-8843.ts'
import { templatesFor, type FormId } from './templates.ts'
import { EMPTY_FACTS, type FormFacts, type FormFill } from './types.ts'

export type BuildForms = {
  year: number
  docs: readonly ConfirmedDocument[]
  facts?: FormFacts
  /** The estimate with its amounts (never the one with numbers hidden) */
  estimate: Estimate
  /** The answers the 1040-NR needs from the person (marital status, digital assets), as in the tax input */
  person?: Pick<TaxInput['person'], 'marital' | 'digitalAssets'>
}

const notReady = (id: FormId, reason: string): FormFill => ({ id, status: 'not-ready', reason, values: {}, overlays: [], blank: [], check: [], notIncluded: [] })

export function buildForms({ year, docs, facts = EMPTY_FACTS, estimate, person }: BuildForms): Record<FormId, FormFill> {
  const templates = templatesFor(year)
  if (!templates) return { 'form-8843': notReady('form-8843', 'We can’t prepare this tax year yet.'), 'form-1040nr': notReady('form-1040nr', 'We can’t prepare this tax year yet.') }

  // Anything still to confirm holds both back (the details come from what you confirmed)
  const waiting = estimate.blockers.length ? 'Waiting for the items listed above.' : null

  const fed = estimate.federal
  const fedReason = waiting ?? (isCalculated(fed) ? (fed.amount === null ? 'Turn on “Show estimate number” to download this form.' : null) : fed.status === 'not-calculated' ? (fed.missing[0] ?? 'There’s no estimate yet.') : fed.status === 'not-supported' ? fed.message : 'There’s no estimate yet.')

  return {
    'form-8843': waiting ? notReady('form-8843', waiting) : build8843({ docs, facts, year }),
    'form-1040nr': fedReason ? notReady('form-1040nr', fedReason) : build1040NR({ docs, estimate, person }),
  }
}

/** What /result shows for each form (no field values: only the status and the honest lists). */
export function formStatuses(fills: Record<FormId, FormFill>, year: number): FormStatus[] {
  const t = templatesFor(year)
  return (['form-8843', 'form-1040nr'] as const).map((id) => {
    const fill = fills[id]
    const label = t?.[id].label ?? (id === 'form-8843' ? 'Form 8843' : 'Form 1040-NR')
    return fill.status === 'ready' ? { id, label, status: 'ready', blank: fill.blank, check: fill.check, notIncluded: fill.notIncluded } : { id, label, status: 'not-ready', reason: fill.reason }
  })
}
