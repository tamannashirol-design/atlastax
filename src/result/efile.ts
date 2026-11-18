// The E-file CONCEPT screen (/result/efile): which label, amount and options to show for an estimate. Pure (no React).
// It reads the federal section of the Estimate (the 1040-NR is what would be e-filed) and decides nothing about tax.
// Nothing here is connected to the IRS: a card, bank or direct deposit option goes to the celebration screen.
// TODO confirm with CPA: which payment and refund methods exist for a Form 1040-NR (and whether a student can e-file it at all).
import { isCalculated, type Estimate } from '../tax/estimate.ts'

/** celebrate = straight to the "taxes are done" screen (no details asked; concept only); sheet = opens "What to do next" (paper: print, sign, mail) */
export type EfileOption = { id: 'card' | 'bank' | 'direct-deposit' | 'check' | 'paper-check'; label: string; action: 'celebrate' | 'sheet' }

export type EfileView =
  | { kind: 'owed'; label: 'Amount owed'; cents: number | null; heading: string; options: EfileOption[] }
  | { kind: 'refund'; label: 'Your refund'; cents: number | null; heading: string; options: EfileOption[] }
  /** Nothing to pay, no refund */
  | { kind: 'none'; message: string }
  /** No number yet (something is missing, or this year can't be estimated) */
  | { kind: 'unavailable'; message: string }


export function efileView(estimate: Estimate): EfileView {
  const f = estimate.federal
  if (estimate.blockers.length > 0 || !isCalculated(f)) return { kind: 'unavailable', message: 'We don’t have a number for you yet. Finish your estimate first.' }
  if (f.status === 'zero') return { kind: 'none', message: 'We estimate you owe nothing, and no refund is due.' }
  if (f.status === 'owed') {
    return {
      kind: 'owed',
      label: 'Amount owed',
      cents: f.amount,
      heading: 'Ways to pay',
      options: [
        { id: 'card', label: 'Debit or credit card', action: 'celebrate' },
        { id: 'bank', label: 'Bank account', action: 'celebrate' },
        { id: 'check', label: 'Pay by check', action: 'sheet' },
      ],
    }
  }
  return {
    kind: 'refund',
    label: 'Your refund',
    cents: f.amount,
    heading: 'Ways to get your refund',
    options: [
      { id: 'direct-deposit', label: 'Direct deposit', action: 'celebrate' },
      { id: 'paper-check', label: 'Paper check by mail', action: 'sheet' },
    ],
  }
}
