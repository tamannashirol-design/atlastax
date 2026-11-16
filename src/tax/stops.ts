// Answers that mean NO estimate number yet, with the reason in plain words. Pure. The ONE place these live:
// the federal estimate (federal.ts) and the state estimate (state.ts) both read it.
//   - married at the end of the year: a married nonresident can't file as single, and the estimate only
//     does single so far
//   - digital assets received or sold in the year: the estimate can't include them yet
// Not answered (an older session) changes nothing: single is assumed, and the page says so.
import type { TaxInput } from './input.ts'

export function noNumberReasons(input: Pick<TaxInput, 'year' | 'person'>): string[] {
  const reasons: string[] = []
  if (input.person.marital === 'married') reasons.push(`You were married at the end of ${input.year}. The estimate only works for single filers so far.`)
  if (input.person.digitalAssets === 'yes') reasons.push(`You received or sold digital assets in ${input.year}. The estimate can’t include them yet.`)
  return reasons
}
