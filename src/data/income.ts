// Income types for Q6 (see FLOW.md). Form codes are shown only where one form
// clearly applies; the rest are left blank on purpose (to confirm with a tax expert).
// Illustrations: the designer's files in src/assets/illustrations/, matched by
// filename. `npm run illustrations` makes the 1x/2x/3x WebP copies used here.
const files = import.meta.glob<string>('../assets/illustrations/generated/*.webp', { eager: true, import: 'default', query: '?url' })

export type Art = { src: string; srcSet: string }

function art(name: string): Art {
  const at = (x: number) => files[`../assets/illustrations/generated/income-${name}@${x}x.webp`]
  return { src: at(1), srcSet: `${at(1)} 1x, ${at(2)} 2x, ${at(3)} 3x` }
}

export type IncomeId =
  | 'bank-interest' | 'opt-cpt' | 'on-campus-job' | 'scholarship' | 'freelance'
  | 'investments' | 'trading' | 'contract-work' | 'no-earnings' | 'donation' | 'child-care'

export type IncomeOption = { id: IncomeId; label: string; form?: string; art?: Art; file?: string }

/** Group 1: income. "No earnings" is last and has no illustration. */
export const incomeOptions: IncomeOption[] = [
  { id: 'bank-interest', label: 'Bank interest', art: art('bank'), file: 'income-bank.png' },
  { id: 'opt-cpt', label: 'OPT or CPT', form: 'W-2', art: art('optcpt'), file: 'income-optcpt.png.png' },
  { id: 'on-campus-job', label: 'On-campus job', form: 'W-2', art: art('oncampusjob'), file: 'income-oncampusjob.png' },
  { id: 'scholarship', label: 'Scholarship or fellowship', form: '1042-S', art: art('scholarship'), file: 'income-scholarship.png' },
  { id: 'freelance', label: 'Freelance', form: '1099-NEC', art: art('freelance'), file: 'income-freelance.png' },
  { id: 'investments', label: 'Investments', art: art('investments'), file: 'income-investments.png' },
  { id: 'trading', label: 'Trading', art: art('trading'), file: 'income-trading.png' },
  { id: 'contract-work', label: 'Contract work', form: '1099-NEC', art: art('contract'), file: 'income-contract.png' },
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
