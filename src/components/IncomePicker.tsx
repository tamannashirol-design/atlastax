import { ILLUSTRATIONS_APPROVED } from '../config'
import { extraOptions, incomeOptions, toggleIncome, type IncomeId, type IncomeOption } from '../data/income'
import { useUrlFlag } from '../lib/debug'
import { IncomeCard } from './IncomeCard'

// Q6 answers: two groups of multi-select cards on the question grid.
//   3 across on iPad + laptop (each card = 2 grid columns), 2 across on phone.
//   "No earnings" is the last card; full width on phone.
// Screen readers: each group is role="group" with checkboxes, and a hidden
// live count ("3 selected") is announced politely.

type Props = { labelledBy: string; value: IncomeId[]; onChange: (v: IncomeId[]) => void }

export function IncomePicker({ labelledBy, value, onChange }: Props) {
  const [preview] = useUrlFlag('art')
  const showArt = ILLUSTRATIONS_APPROVED || preview
  const toggle = (id: IncomeId) => onChange(toggleIncome(value, id))

  const cards = (options: IncomeOption[], offset: number) =>
    options.map((o, i) => (
      <div key={o.id} className={`flex ${o.id === 'no-earnings' ? 'col-span-2 tablet:col-span-1' : ''}`}>
        <IncomeCard
          label={o.label}
          form={o.form}
          art={o.art}
          showArt={showArt}
          quiet={o.id === 'no-earnings'}
          checked={value.includes(o.id)}
          onToggle={() => toggle(o.id)}
          index={offset + i}
        />
      </div>
    ))

  return (
    <div className="flex flex-col gap-10">
      <div role="group" aria-labelledby={labelledBy} className="grid auto-rows-fr grid-cols-2 gap-(--grid-gutter) tablet:grid-cols-3">
        {cards(incomeOptions, 0)}
      </div>
      <div className="flex flex-col gap-4">
        <h2 id={`${labelledBy}-extra`} className="font-display text-title">
          Anything else that applies?
        </h2>
        <div role="group" aria-labelledby={`${labelledBy}-extra`} className="grid auto-rows-fr grid-cols-2 gap-(--grid-gutter) tablet:grid-cols-3">
          {cards(extraOptions, incomeOptions.length)}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {value.length} selected
      </span>
    </div>
  )
}
