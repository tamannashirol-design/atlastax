import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { OTHER_WAYS_TO_FILE } from '../residency.config'

// "Other ways to file" (stop screen and Home's not-supported state). Links
// open in a new tab: marked with an icon and for screen readers. Never blue:
// these are ways to file elsewhere, not a next step in AtlasTax.
export function OtherWaysToFile() {
  return (
    <ul className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-strong bg-surface">
      {OTHER_WAYS_TO_FILE.map((o) => (
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
  )
}
