// R1 TRANSCRIPTION: the values the person CONFIRMED on Review → tax input.
// The ONE place this happens (AFTER-DOCUMENTS-PLAN.md §4). Pure: no React, no network.
// Components never read documents or answers to do tax logic; the server calls this.
//
// Rules (each tested by `npm run check:taxinput`):
//   - only CONFIRMED values go in: a value that needs a tick (needsTick in
//     extraction.config.ts, or the reader marked it "Please check") and isn't ticked
//     is never used; it becomes a blocker instead
//   - every required document must be added AND confirmed (passport and I-94 too)
//   - an amount that isn't a valid amount is a blocker, never rounded or guessed
//   - "Not on my form" counts as zero / none only where the field may be blank
//     (mayBeBlank) and only because the person chose it
//   - documents and income the engine can't read yet are listed in `other`, so the
//     engine (R2) can say "no number" with a clear message
//   - the output holds NO ID numbers (SSN, ITIN, EIN, passport): none are needed for
//     the calculation, and a test fails if one appears
// Money is in whole CENTS (integers), converted from the confirmed text.
import { FIELDS, ITEM_FORMS, type FieldSpec, type FormType } from '../extraction.config.ts'

/** One value as confirmed (server side). `value` is the text the person confirmed or typed. */
export type ConfirmedField = { value: string; ticked: boolean; notOnForm: boolean; confidence: 'high' | 'low' | 'missing' }
export type ConfirmedDocument = { itemId: string; form: FormType; status: 'open' | 'confirmed' | 'skipped'; fields: Record<string, ConfirmedField> }

/** The part of requiredItems() the builder needs (small enough to send as JSON) */
export type TaxItem = {
  id: string
  /** document: a form is expected · income: self-reported, no form */
  kind: 'document' | 'income'
  /** Plain name: "W-2 from your employer", "Freelance income" */
  label: string
  /** document: added | later | none | missing · income: details-needed | later | provided */
  status: string
  optional?: boolean
}

/** Where a blocker sends the person (same shape as the app's other targets) */
export type Target = { path: string; state: Record<string, unknown> | null }
export type Blocker = { id: string; reason: string; fix: { label: string; target: Target } }

export type WageInput = {
  itemId: string
  /** Employer name, only when confirmed (display only) */
  employer: string | null
  /** W-2 box 1, cents */
  wages: number
  /** W-2 box 2, cents */
  federalWithheld: number
  /** W-2 box 15 (two letters), null when "Not on my form" */
  stateCode: string | null
  /** W-2 box 16, cents (0 when "Not on my form") */
  stateWages: number
  /** W-2 box 17, cents (0 when "Not on my form") */
  stateWithheld: number
}

/** Confirmed (or self-reported) income the engine doesn't read yet */
export type OtherIncome = { itemId: string; form: FormType | null; label: string }

export type TaxInput = {
  year: number
  /** Always single for now: there is no marital-status question yet (assumption, shown on the result) */
  filingStatus: 'single'
  person: {
    citizenship: string | null
    visa: string | null
    /** Where they lived just before coming to the U.S. (region code): what the student treaties go by */
    livedBefore: string | null
    /** Marital status at the end of the year; null = not answered (single is assumed, and said so) */
    marital: 'single' | 'married' | null
    /** Received or sold digital assets in the year; null = not answered */
    digitalAssets: 'yes' | 'no' | null
  }
  wages: WageInput[]
  other: OtherIncome[]
  /** The income cards the person picked (decides what the engine must handle) */
  incomeTypesPresent: string[]
  /** Why there is no number yet. Empty: ready for the engine. */
  blockers: Blocker[]
  assumptions: string[]
}

export type BuildArgs = {
  year: number
  person: { citizenship?: string; visa?: string; livedBefore?: string; marital?: 'single' | 'married'; digitalAssets?: 'yes' | 'no' }
  income: string[]
  items: TaxItem[]
  documents: ConfirmedDocument[]
}

/** "24,180.00" → 2418000. null for anything that isn't a plain, non-negative amount with at most 2 decimals. */
export function toCents(text: string | undefined): number | null {
  const t = (text ?? '').trim()
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(t)) return null
  const [whole, frac = ''] = t.replace(/,/g, '').split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

const review = (id: string): Target => ({ path: '/review', state: { doc: id } })
const documents = (id: string): Target => ({ path: `/documents#item-${id}`, state: null })
const formName = (form: FormType | undefined) => form ?? 'document'

/** Does this value need the person's tick before it may be used? */
const needsTick = (spec: FieldSpec, f: ConfirmedField) => spec.needsTick || f.confidence === 'low'

export function buildTaxInput({ year, person, income, items, documents: docs }: BuildArgs): TaxInput {
  const blockers: Blocker[] = []
  const wages: WageInput[] = []
  const other: OtherIncome[] = []
  const block = (b: Blocker) => blockers.push(b)

  for (const item of items) {
    if (item.optional) continue // a state ID or a previous return never holds anything up
    if (item.kind === 'income') {
      // Self-reported income (no form): nothing to read, and the engine can't handle it yet
      if (item.status === 'later') block({ id: `${item.id}:details`, reason: `${item.label}: details not added yet.`, fix: { label: 'Add the details', target: documents(item.id) } })
      else other.push({ itemId: item.id, form: null, label: item.label })
      continue
    }
    if (item.status !== 'added') {
      block({ id: `${item.id}:missing`, reason: `${item.label}: not added yet.`, fix: { label: `Add your ${item.label}`, target: documents(item.id) } })
      continue
    }
    const doc = docs.find((d) => d.itemId === item.id)
    const form = doc?.form ?? ITEM_FORMS[item.id]?.[0]
    if (!doc || doc.status !== 'confirmed') {
      block({ id: `${item.id}:unconfirmed`, reason: `${item.label}: not confirmed yet.`, fix: { label: `Check your ${formName(form)}`, target: review(item.id) } })
      continue
    }

    // Confirmed: use only the values that are properly confirmed
    const specs = FIELDS[doc.form]
    const used: Record<string, string | null> = {} // key → confirmed text, or null = "Not on my form"
    let ok = true
    for (const spec of specs) {
      const f = doc.fields[spec.key]
      const noValue = !f || f.value.trim() === ''
      if (f?.notOnForm && spec.mayBeBlank) {
        used[spec.key] = null
      } else if (noValue) {
        ok = false
        block({ id: `${item.id}:${spec.key}:missing`, reason: `${item.label}: ${spec.label} is missing.`, fix: { label: `Check your ${doc.form}`, target: review(item.id) } })
      } else if (needsTick(spec, f) && !f.ticked) {
        ok = false
        block({ id: `${item.id}:${spec.key}:unticked`, reason: `${item.label}: ${spec.label} hasn’t been marked correct.`, fix: { label: `Check your ${doc.form}`, target: review(item.id) } })
      } else {
        used[spec.key] = f.value.trim()
      }
    }
    if (!ok) continue

    if (doc.form === 'W-2') {
      const money = (key: string, label: string): number | null => {
        const text = used[key]
        if (text === null) return 0 // "Not on my form" (only possible where the field may be blank)
        const c = toCents(text)
        if (c === null) block({ id: `${item.id}:${key}:invalid`, reason: `${item.label}: ${label} isn’t a valid amount.`, fix: { label: 'Check your W-2', target: review(item.id) } })
        return c
      }
      const w = money('wages', 'Wages')
      const fed = money('federalWithheld', 'Federal tax withheld')
      const sw = money('stateWages', 'State wages')
      const st = money('stateWithheld', 'State tax withheld')
      if (w === null || fed === null || sw === null || st === null) continue
      const state = used.state
      wages.push({ itemId: item.id, employer: used.employerName ?? null, wages: w, federalWithheld: fed, stateCode: state ? state.toUpperCase() : null, stateWages: sw, stateWithheld: st })
    } else if (doc.form !== 'Passport' && doc.form !== 'I-94') {
      // 1042-S, 1099s: confirmed, but the engine doesn't read them yet
      other.push({ itemId: item.id, form: doc.form, label: item.label })
    }
  }

  return {
    year,
    filingStatus: 'single',
    person: { citizenship: person.citizenship ?? null, visa: person.visa ?? null, livedBefore: person.livedBefore ?? null, marital: person.marital ?? null, digitalAssets: person.digitalAssets ?? null },
    wages,
    other,
    incomeTypesPresent: [...income],
    blockers,
    assumptions: ['Filing status: single (we don’t ask yet).'],
  }
}

/** The small, non-sensitive summary of requiredItems() the server needs (no file names). */
export function taxItemsFrom(
  items: ReadonlyArray<{ id: string; kind: 'document' | 'income'; status: string; optional?: boolean; form?: string; incomeLabel?: string; label?: string }>,
): TaxItem[] {
  return items.map((i) => ({
    id: i.id,
    kind: i.kind,
    label: i.kind === 'income' ? (i.incomeLabel ?? i.label ?? i.id) : (i.form ?? i.label ?? i.id),
    status: i.status,
    ...(i.optional ? { optional: true } : {}),
  }))
}
