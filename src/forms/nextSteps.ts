// "What to do next": the steps shown in a sheet after a download on /result. Pure: no React, no network.
// Which steps show is decided HERE from the estimate (the result: owed, refund or neither; which due date applies),
// never in the component. The words, addresses and links come from src/tax/years/filing-2025.ts, each with its
// IRS page. Plain words; no promises about refund timing; nothing about filing late (the sheet assumes the
// person is filing before the due date, as designed).
import type { Estimate } from '../tax/estimate.ts'
import { isCalculated } from '../tax/estimate.ts'
import { yearConfig } from '../tax/years/index.ts'

export type StepId = 'print' | 'attach' | 'mail' | 'pay' | 'refund'

export type NextStep = {
  id: StepId
  title: string
  /** Plain sentences, in order */
  body: string[]
  /** Mailing addresses (step "mail") */
  addresses?: { label: string; lines: readonly string[]; note?: string }[]
  /** Links to official IRS pages (step "pay") */
  links?: { label: string; href: string }[]
  /** Small print under the step: updates to check, etc. */
  small?: string[]
  /** The IRS page this step comes from, shown under it (short; the full quote is in filing-2025.ts) */
  source: string
}

export type NextSteps = {
  title: 'What to do next'
  /** "Your 2025 return is due April 15, 2026." (upcoming, never late wording) */
  due: string
  steps: NextStep[]
}

/** The steps for this estimate, or null for a year with no filing details. */
export function nextSteps(estimate: Pick<Estimate, 'year' | 'federal' | 'dueBasis'>): NextSteps | null {
  const f = yearConfig(estimate.year)?.filing
  if (!f) return null
  const due = estimate.dueBasis === 'no-wages' ? f.due.noWages : f.due.wages
  const result = isCalculated(estimate.federal) ? estimate.federal.status : null

  const steps: NextStep[] = [
    {
      id: 'print',
      title: 'Print your forms and sign the 1040-NR',
      body: ['Sign and date the 1040-NR by hand.', 'Fill in anything we left blank. The last page of each download lists what that is.'],
      source: 'Form 1040-NR (2025), page 2, “Sign Here”',
    },
    {
      id: 'attach',
      title: 'Attach Copy B of your W-2 to the front of the 1040-NR',
      body: [f.attach.copyB, f.attach.others],
      source: f.attach.cite,
    },
    {
      id: 'mail',
      title: 'Mail it',
      body: ['Use the address that matches whether you’re sending a payment.'],
      addresses: [
        { label: 'Not sending a payment', lines: f.mail.withoutPayment.lines },
        { label: 'Sending a payment', lines: f.mail.withPayment.lines, note: f.mail.postOfficeBoxNote },
      ],
      small: [f.mail.updatesNote],
      source: f.mail.cite,
    },
  ]
  if (result === 'owed') {
    steps.push({
      id: 'pay',
      title: 'Pay what you owe',
      body: ['Pay online on irs.gov, or send a check or money order with your return.', f.pay.check],
      links: [
        { label: 'Pay on irs.gov', href: f.pay.url },
        { label: 'No U.S. bank account? See how to pay', href: f.pay.foreignUrl },
      ],
      source: f.pay.cite,
    })
  }
  if (result === 'refund') {
    steps.push({
      id: 'refund',
      title: 'Your refund',
      body: ['The IRS sends your refund after it processes your return. You don’t need to do anything after you mail it.', 'The download leaves how you’d like to be paid (lines 35a to 35e) blank. Fill that in by hand before you mail it.'],
      source: f.refund.cite,
    })
  }
  return { title: 'What to do next', due: `Your ${estimate.year} return is due ${due.date}.`, steps }
}
