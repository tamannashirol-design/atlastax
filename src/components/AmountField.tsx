import { useId } from 'react'

// Dollar amount field, 56pt tall: "$" · number (tabular) · "USD".
// Opens the number keypad on phones. Accepts digits, commas and one decimal point.

type Props = { labelledBy: string; value: string; onChange: (v: string) => void; id?: string; describedBy?: string; onBlur?: () => void }

export function AmountField({ labelledBy, value, onChange, id, describedBy, onBlur }: Props) {
  const hint = useId()
  return (
    <div className="flex h-14 w-full items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text">
      <span aria-hidden className="text-body text-text-muted">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        id={id}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy ? `${describedBy} ${hint}` : hint}
        onBlur={onBlur}
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        className="h-full min-w-0 flex-1 bg-transparent text-body tabular-nums outline-none placeholder:text-text-muted"
      />
      <span id={hint} className="text-small text-text-muted">
        USD
      </span>
    </div>
  )
}

/** The amount as a number, or NaN if it isn't a valid amount. */
export function parseAmount(s: string | undefined): number {
  if (!s || !/^\d{1,3}(,?\d{3})*(\.\d{0,2})?$|^\d+(\.\d{0,2})?$/.test(s.trim())) return NaN
  return Number(s.replace(/,/g, ''))
}
