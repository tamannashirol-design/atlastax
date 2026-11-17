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

/** A confirmed Form 1042-S for a scholarship or fellowship (the "scholarship" document). Boxes per the 2025
 *  Instructions for Form 1042-S: box 1 income code (page 24; Appendix A, page 36), box 2 gross income (page 25),
 *  box 3a chapter 3 exemption code and box 3b tax rate (page 26), box 10 total withholding credit (page 29). */
export type ScholarshipInput = {
  itemId: string
  /** Box 12d, withholding agent's name (display only) */
  payer: string | null
  /** Box 1 (16 = scholarship or fellowship grants) */
  incomeCode: string
  /** Box 2, cents */
  gross: number
  /** Box 3a; null when "Not on my form" */
  exemptionCode: string | null
  /** Box 3b as printed (e.g. "14.00"); null when "Not on my form" */
  taxRate: string | null
  /** Box 10 (7a + 8 + 9), cents: what Form 1040-NR line 25g credits */
  withheld: number
}

/** A confirmed Form 1099-INT for bank interest (the "bank-interest" document) */
export type InterestInput = {
  itemId: string
  /** The bank (display only) */
  payer: string | null
  /** Box 1, cents */
  interest: number
  /** Box 4 (federal income tax withheld), cents; 0 when "Not on my form" */
  withheld: number
}

/** Dividends or interest on the "investments" document: a 1042-S (boxes 1, 2, 3a, 3b, 10, as for scholarships) or a
 *  1099-DIV (box 1a ordinary dividends, box 4 withheld; it shows no rate) */
export type InvestmentInput = {
  itemId: string
  form: '1042-S' | '1099-DIV'
  payer: string | null
  /** 1042-S box 1; null for a 1099-DIV */
  incomeCode: string | null
  /** 1042-S box 2 or 1099-DIV box 1a, cents */
  gross: number
  /** 1042-S box 3a; null for a 1099-DIV or "Not on my form" */
  exemptionCode: string | null
  /** 1042-S box 3b (e.g. "30.00"); null for a 1099-DIV or "Not on my form" */
  taxRate: string | null
  /** 1042-S box 10 (line 25g) or 1099-DIV box 4 (line 25b), cents */
  withheld: number
}

/** Sales on the "trading" document: a 1099-B (box 1d proceeds, 1e cost basis, 4 withheld) or a 1042-S */
export type TradeInput = {
  itemId: string
  form: '1099-B' | '1042-S'
  payer: string | null
  /** 1099-B box 1d, cents (1042-S: box 2) */
  proceeds: number
  /** 1099-B box 1e, cents; null when "Not on my form" (then the gain can't be worked out) */
  costBasis: number | null
  /** 1099-B box 4 (line 25b) or 1042-S box 10, cents */
  withheld: number
  /** 1042-S box 1 only */
  incomeCode: string | null
}

/** The answers to the scholarship questions (src/flow/screens.tsx): what it paid for, and the stipend for living costs */
export type ScholarshipUse = {
  paidFor: 'tuition' | 'living' | 'both' | null
  /** Cents; only for "both" */
  stipend: number | null
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
    /** Days in the U.S. in the tax year, from "Time in the U.S." (only when every count is answered); null = not known */
    daysInUS: number | null
    /** "In 2025, was your main home in the U.S. or in your home country?" (asked only with trading income and 183+ days):
     *  the stand-in for the tax home (Pub 519 (2025), pages 8 and 20). null = not asked or not answered. */
    taxHome: 'us' | 'home' | null
  }
  wages: WageInput[]
  scholarships: ScholarshipInput[]
  bankInterest: InterestInput[]
  scholarshipUse: ScholarshipUse
  investments: InvestmentInput[]
  trades: TradeInput[]
  other: OtherIncome[]
  /** The income cards the person picked (decides what the engine must handle) */
  incomeTypesPresent: string[]
  /** Why there is no number yet. Empty: ready for the engine. */
  blockers: Blocker[]
  assumptions: string[]
}

export type BuildArgs = {
  year: number
  person: { citizenship?: string; visa?: string; livedBefore?: string; marital?: 'single' | 'married'; digitalAssets?: 'yes' | 'no'; daysInUS?: number; taxHome?: 'us' | 'home' }
  income: string[]
  items: TaxItem[]
  documents: ConfirmedDocument[]
  /** The scholarship answers as the browser sent them (checked here) */
  scholarshipUse?: { paidFor?: unknown; stipend?: unknown }
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

export function buildTaxInput({ year, person, income, items, documents: docs, scholarshipUse: use }: BuildArgs): TaxInput {
  const blockers: Blocker[] = []
  const wages: WageInput[] = []
  const scholarships: ScholarshipInput[] = []
  const bankInterest: InterestInput[] = []
  const investments: InvestmentInput[] = []
  const trades: TradeInput[] = []
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

    const money = (key: string, label: string): number | null => {
      const text = used[key]
      if (text === null) return 0 // "Not on my form" (only possible where the field may be blank)
      const c = toCents(text)
      if (c === null) block({ id: `${item.id}:${key}:invalid`, reason: `${item.label}: ${label} isn’t a valid amount.`, fix: { label: `Check your ${doc.form}`, target: review(item.id) } })
      return c
    }
    if (doc.form === 'W-2') {
      const w = money('wages', 'Wages')
      const fed = money('federalWithheld', 'Federal tax withheld')
      const sw = money('stateWages', 'State wages')
      const st = money('stateWithheld', 'State tax withheld')
      if (w === null || fed === null || sw === null || st === null) continue
      const state = used.state
      wages.push({ itemId: item.id, employer: used.employerName ?? null, wages: w, federalWithheld: fed, stateCode: state ? state.toUpperCase() : null, stateWages: sw, stateWithheld: st })
    } else if (doc.form === '1042-S' && item.id === 'scholarship') {
      const gross = money('grossIncome', 'Gross income')
      const withheld = money('federalWithheld', 'Total tax withheld')
      if (gross === null || withheld === null) continue
      scholarships.push({ itemId: item.id, payer: used.withholdingAgent ?? null, incomeCode: (used.incomeCode ?? '').trim(), gross, exemptionCode: used.exemptionCode?.trim() || null, taxRate: used.taxRate?.trim() || null, withheld })
    } else if (doc.form === '1099-INT' && item.id === 'bank-interest') {
      const interest = money('interest', 'Interest income')
      const withheld = money('federalWithheld', 'Federal tax withheld')
      if (interest === null || withheld === null) continue
      bankInterest.push({ itemId: item.id, payer: used.payerName ?? null, interest, withheld })
    } else if (item.id === 'investments' && (doc.form === '1042-S' || doc.form === '1099-DIV')) {
      const is1042 = doc.form === '1042-S'
      const gross = money(is1042 ? 'grossIncome' : 'ordinaryDividends', is1042 ? 'Gross income' : 'Total ordinary dividends')
      const withheld = money('federalWithheld', 'Federal tax withheld')
      if (gross === null || withheld === null) continue
      investments.push({ itemId: item.id, form: doc.form, payer: (is1042 ? used.withholdingAgent : used.payerName) ?? null, incomeCode: is1042 ? (used.incomeCode ?? '').trim() : null, gross, exemptionCode: is1042 ? used.exemptionCode?.trim() || null : null, taxRate: is1042 ? used.taxRate?.trim() || null : null, withheld })
    } else if (item.id === 'trading' && doc.form === '1099-B') {
      const proceeds = money('proceeds', 'Total proceeds')
      const basis = used.costBasis === null ? null : money('costBasis', 'Total cost basis')
      const withheld = money('federalWithheld', 'Federal tax withheld')
      if (proceeds === null || withheld === null || (used.costBasis !== null && basis === null)) continue
      trades.push({ itemId: item.id, form: '1099-B', payer: used.payerName ?? null, proceeds, costBasis: basis, withheld, incomeCode: null })
    } else if (item.id === 'trading' && doc.form === '1042-S') {
      const gross = money('grossIncome', 'Gross income')
      const withheld = money('federalWithheld', 'Total tax withheld')
      if (gross === null || withheld === null) continue
      trades.push({ itemId: item.id, form: '1042-S', payer: used.withholdingAgent ?? null, proceeds: gross, costBasis: null, withheld, incomeCode: (used.incomeCode ?? '').trim() })
    } else if (doc.form !== 'Passport' && doc.form !== 'I-94') {
      // Other forms (freelance, contract work): confirmed, but the engine doesn't read them yet
      other.push({ itemId: item.id, form: doc.form, label: item.label })
    }
  }

  // The scholarship questions: what it paid for decides the taxable part (src/tax/federal.ts). Unanswered: a blocker
  // that goes to the question (never a guess).
  const paidFor = use?.paidFor === 'tuition' || use?.paidFor === 'living' || use?.paidFor === 'both' ? use.paidFor : null
  const stipend = typeof use?.stipend === 'string' ? toCents(use.stipend) : null
  const scholarshipUse: ScholarshipUse = { paidFor, stipend: paidFor === 'both' ? stipend : null }
  const question = (path: string): Target => ({ path, state: null })
  if (scholarships.length && !paidFor) block({ id: 'scholarship:paid-for', reason: 'Scholarship: tell us what it paid for.', fix: { label: 'Answer the question', target: question('/income/scholarship-paid-for') } })
  if (scholarships.length && paidFor === 'both' && (stipend === null || stipend <= 0)) block({ id: 'scholarship:stipend', reason: 'Scholarship: tell us how much of it was for living costs.', fix: { label: 'Answer the question', target: question('/income/scholarship-stipend') } })

  // Trading with 183 days or more in the U.S.: whether the gain is taxed depends on where the main home was. Needed only if
  // there's a gain (or the cost basis is missing, so we can't tell); a loss is never taxed. Unanswered: a blocker to the question.
  const days = Number.isInteger(person.daysInUS) ? person.daysInUS! : null
  const taxHome = person.taxHome === 'us' || person.taxHome === 'home' ? person.taxHome : null
  const mayHaveGain = trades.some((t) => t.costBasis === null) || trades.reduce((n, t) => n + t.proceeds - (t.costBasis ?? 0), 0) > 0
  if (trades.length && days !== null && days >= 183 && taxHome === null && mayHaveGain) block({ id: 'trading:tax-home', reason: 'Trading: tell us where your main home was.', fix: { label: 'Answer the question', target: { path: '/income/trading-tax-home', state: null } } })

  return {
    year,
    filingStatus: 'single',
    person: { citizenship: person.citizenship ?? null, visa: person.visa ?? null, livedBefore: person.livedBefore ?? null, marital: person.marital ?? null, digitalAssets: person.digitalAssets ?? null, daysInUS: Number.isInteger(person.daysInUS) && person.daysInUS! >= 0 && person.daysInUS! <= 366 ? person.daysInUS! : null, taxHome: person.taxHome === 'us' || person.taxHome === 'home' ? person.taxHome : null },
    wages,
    scholarships,
    bankInterest,
    scholarshipUse,
    investments,
    trades,
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
