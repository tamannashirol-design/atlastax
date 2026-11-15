import { art, extraOptions, incomeOptions, type Art } from '../data/income'

// Which of the designer's illustrations each Documents card shows
// (src/assets/illustrations/documents-*.png, made into WebP by
// `npm run illustrations`). Keyed by the item id from documents.config.ts.
// Presentation only: no tax rules here.
const DOCUMENT_ART: Record<string, string> = {
  passport: 'passports',
  i94: 'i94',
  'state-id': 'id',
  'opt-cpt': 'w2',
  'on-campus-job': 'w2',
  scholarship: '1042s-scholarship',
  'bank-interest': 'i099int',
  freelance: 'i099nec',
  'contract-work': 'i099nec',
  investments: '1099div',
  trading: '1042s-investing',
}

/** A document's illustration, or undefined if none exists yet */
export function documentArt(id: string): Art | undefined {
  const name = DOCUMENT_ART[id]
  return name ? art(name, 'documents') : undefined
}

/** Income without a form: that income card's own illustration (no form to show) */
export function incomeArt(incomeId: string): Art | undefined {
  return [...incomeOptions, ...extraOptions].find((o) => o.id === incomeId)?.art
}
