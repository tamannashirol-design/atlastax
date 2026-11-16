// The browser's side of /result: asks our server for the estimate. The server holds the
// confirmed values; the browser sends only a small, non-sensitive summary of its required
// documents (types and status, visa, citizenship) and stores no amounts anywhere.
import type { Answers } from '../flow/answers'
import { requiredItems } from '../flow/requiredDocuments'
import { sessionReady } from '../lib/session'
import type { Estimate } from './estimate'
import { formFacts } from '../forms/facts'
import { taxItemsFrom } from './input'

/** What the server needs: a small non-sensitive summary of the documents, and the facts the forms need from the answers (visa, citizenship, days counted). No ID numbers, no travel history. */
export function estimateRequest(a: Answers, year: number) {
  return { person: { citizenship: a.citizenship, visa: a.visa }, income: a.income ?? [], items: taxItemsFrom(requiredItems(a)), facts: formFacts(a, year) }
}

export async function fetchEstimate(year: number, a: Answers, numbers: boolean): Promise<Estimate> {
  await sessionReady()
  const r = await fetch(`/api/estimate?year=${year}&numbers=${numbers ? 1 : 0}`, { method: 'POST', body: JSON.stringify(estimateRequest(a, year)) })
  if (!r.ok) throw new Error('estimate')
  return (await r.json()) as Estimate
}
