import { ILLUSTRATIONS_APPROVED } from '../config'
import { extraOptions, incomeOptions, toggleIncome, type IncomeId, type IncomeOption } from '../data/income'
import { useUrlFlag } from '../lib/debug'
import { IncomeCard, IncomeRow } from './IncomeCard'

// Q6 answers: two groups of multi-select cards on the question grid.
// Each card = 2 grid columns at 600px+, so card size never changes:
//   phone 2 across · 600–1023px 3 across (6 columns, same edges as the other
//   screens) · 1024px+ 4 across (the screen is "wide": 8 columns, cols 4–11).
// The 8 income types fill 2 full rows at 4 across. "No earnings" is not a
// card: it's a slim full-width row below them, still in the same group.
// Screen readers: each group is role="group" with checkboxes, and a hidden
// live count ("3 selected") is announced politely.

type Props = { labelledBy: string; value: IncomeId[]; onChange: (v: IncomeId[]) => void }

export function IncomePicker({ labelledBy, value, onChange }: Props) {
  const [preview] = useUrlFlag('art')
  const showArt = ILLUSTRATIONS_APPROVED || preview
  const toggle = (id: IncomeId) => onChange(toggleIncome(value, id))

  const grid = 'grid auto-rows-fr grid-cols-2 gap-(--grid-gutter) tablet:grid-cols-3 desktop:grid-cols-4'
  const types = incomeOptions.filter((o) => o.id !== 'no-earnings')
  const none = incomeOptions.find((o) => o.id === 'no-earnings')!

  const cards = (options: IncomeOption[], offset: number) =>
    options.map((o, i) => (
      <div key={o.id} className="flex">
        <IncomeCard
          label={o.label}
          form={o.form}
          art={o.art}
          showArt={showArt}
          checked={value.includes(o.id)}
          onToggle={() => toggle(o.id)}
          index={offset + i}
        />
      </div>
    ))

  return (
    <div className="flex flex-col gap-10">
      <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-(--grid-gutter)">
        <div className={grid}>{cards(types, 0)}</div>
        <IncomeRow label={none.label} hint="None of the above" checked={value.includes(none.id)} onToggle={() => toggle(none.id)} index={types.length} />
      </div>
      <div className="flex flex-col gap-4">
        <h2 id={`${labelledBy}-extra`} className="font-display text-title">
          Anything else that applies?
        </h2>
        <div role="group" aria-labelledby={`${labelledBy}-extra`} className={grid}>
          {cards(extraOptions, incomeOptions.length)}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {value.length} selected
      </span>
    </div>
  )
}
