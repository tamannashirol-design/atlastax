import { incomeCardForm } from '../flow/requiredDocuments'
// Income types for Q6 (see FLOW.md). The form code under a card's label comes
// from documents.config.ts (showOnIncomeCard), the one place tax rules live.
// Illustrations: the designer's files in src/assets/illustrations/, matched by
// filename. `npm run illustrations` trims and normalizes them (equal ~8% padding
// in a 384px square) and exports 96/192/288px WebP copies, used here.
const files = import.meta.glob<string>('../assets/illustrations/generated/*.webp', { eager: true, import: 'default', query: '?url' })

/** srcSet uses widths; `sizes` matches the icon box (80px phone, 96px from 600px). */
export type Art = { src: string; srcSet: string; sizes: string }

export function art(name: string): Art {
  const at = (px: number) => files[`../assets/illustrations/generated/income-${name}-${px}.webp`]
  return { src: at(96), srcSet: `${at(96)} 96w, ${at(192)} 192w, ${at(288)} 288w`, sizes: '(width >= 600px) 96px, 80px' }
}

export type IncomeId =
  | 'bank-interest' | 'opt-cpt' | 'on-campus-job' | 'scholarship' | 'freelance'
  | 'investments' | 'trading' | 'contract-work' | 'no-earnings' | 'donation' | 'child-care'

export type IncomeOption = { id: IncomeId; label: string; form?: string; art?: Art; file?: string }

/** Group 1: income. "No earnings" is last and has no illustration. */
export const incomeOptions: IncomeOption[] = [
  { id: 'bank-interest', label: 'Bank interest', art: art('bank'), file: 'income-bank.png' },
  { id: 'opt-cpt', label: 'OPT or CPT', form: incomeCardForm('opt-cpt'), art: art('optcpt'), file: 'income-optcpt.png.png' },
  { id: 'on-campus-job', label: 'On-campus job', form: incomeCardForm('on-campus-job'), art: art('oncampusjob'), file: 'income-oncampusjob.png' },
  { id: 'scholarship', label: 'Scholarship or fellowship', form: incomeCardForm('scholarship'), art: art('scholarship'), file: 'income-scholarship.png' },
  { id: 'freelance', label: 'Freelance', form: incomeCardForm('freelance'), art: art('freelance'), file: 'income-freelance.png' },
  { id: 'investments', label: 'Investments', art: art('investments'), file: 'income-investments.png' },
  { id: 'trading', label: 'Trading', art: art('trading'), file: 'income-trading.png' },
  { id: 'contract-work', label: 'Contract work', form: incomeCardForm('contract-work'), art: art('contract'), file: 'income-contract.png' },
  { id: 'no-earnings', label: 'No earnings' },
]

/** Group 2: "Anything else that applies?" (deductions and credits, not income). */
export const extraOptions: IncomeOption[] = [
  { id: 'donation', label: 'Donation', art: art('donations'), file: 'income-donations.png' },
  { id: 'child-care', label: 'Child care', art: art('childcare'), file: 'income-childcare.png' },
]

/** "No earnings" clears everything else; anything else clears "No earnings". */
export function toggleIncome(current: IncomeId[], id: IncomeId): IncomeId[] {
  if (id === 'no-earnings') return current.includes(id) ? [] : ['no-earnings']
  const rest = current.filter((x) => x !== 'no-earnings')
  return rest.includes(id) ? rest.filter((x) => x !== id) : [...rest, id]
}
