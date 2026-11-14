import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/SecondaryButton'

// Shown when someone answers "5 years or more" on /years and presses Continue.
// After 5 years, F-1 and J-1 students usually count as U.S. residents for tax
// purposes and file Form 1040, which AtlasTax doesn't prepare (1040-NR only).
// Wording and the 5-year rule are flagged for legal review in FLOW.md.
//
// No blue here: the sheet offers ways to file elsewhere, not a next step in
// AtlasTax. Links open in a new tab, marked with an icon and for screen readers.

type Option = { title: string; body: string; href?: string; site?: string }

const options: Option[] = [
  {
    title: 'IRS Free File',
    body: 'Free tax software from IRS partners, if your income qualifies.',
    href: 'https://www.irs.gov/freefile',
    site: 'irs.gov',
  },
  {
    title: 'Free help from VITA volunteers',
    body: 'IRS-certified volunteers prepare your return for free, if your income qualifies. Some sites are on campus.',
    href: 'https://irs.treasury.gov/freetaxprep/',
    site: 'irs.gov',
  },
  {
    title: 'A tax professional',
    body: 'Your international student office can often recommend one.',
  },
]

export function ResidentSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet title="We can’t file this return for you" onClose={onClose}>
      <p className="text-body text-text-muted">
        With 5 years or more on your visa, you’re likely a U.S. resident for tax purposes. Residents file Form 1040. AtlasTax only prepares
        Form 1040‑NR, for nonresidents.
      </p>

      <h3 className="pt-6 pb-2 text-body font-semibold">Other ways to file</h3>
      <ul className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-strong">
        {options.map((o) => (
          <li key={o.title} className="flex">
            {o.href ? (
              <a
                href={o.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 w-full items-start gap-4 rounded-md px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-semibold underline underline-offset-4">{o.title}</span>
                  <span className="text-small text-text-muted">{o.body}</span>
                  <span className="text-small text-text-muted">
                    {o.site}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </span>
                <ArrowSquareOutIcon size={24} weight="regular" aria-hidden className="shrink-0" />
              </a>
            ) : (
              <div className="flex min-h-14 w-full flex-col px-4 py-3">
                <span className="text-body font-semibold">{o.title}</span>
                <span className="text-small text-text-muted">{o.body}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col pt-8">
        <SecondaryButton onClick={onClose}>Change my answer</SecondaryButton>
      </div>
    </BottomSheet>
  )
}
