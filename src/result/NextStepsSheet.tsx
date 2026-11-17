import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/SecondaryButton'
import { nextSteps } from '../forms/nextSteps'
import type { Estimate } from '../tax/estimate'

// "What to do next": slides up over /result after each download (render it inside <AnimatePresence>). Same sheet as
// the privacy and upload sheets: title, the X (Close), and a quiet "Done" at the bottom. Which steps show, and every
// word, address and link, come from src/forms/nextSteps.ts (never decided here). It opens after a download, and from the
// "How to mail it" button under each Download (no download). The E-file concept is on the downloads card, not here.
const linkClass =
  'flex min-h-11 items-center gap-1 self-start rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export function NextStepsSheet({ estimate, onClose }: { estimate: Estimate; onClose: () => void }) {
  const content = nextSteps(estimate)
  if (!content) return null
  return (
    <BottomSheet title={content.title} onClose={onClose}>
      <p className="text-body text-text-muted">{content.due}</p>
      <ol className="flex flex-col gap-6 pt-6">
        {content.steps.map((s, i) => (
          <li key={s.id} data-step={s.id} className="flex gap-3">
            {/* The number is drawn here (a flex row has no list marker); the <ol> still tells screen readers it's step N */}
            <span aria-hidden className="w-6 shrink-0 text-body font-semibold tabular-nums">
              {i + 1}.
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h3 className="text-body font-semibold">{s.title}</h3>
            {s.body.map((t) => (
              <p key={t} className="text-body">
                {t}
              </p>
            ))}
            {s.addresses?.map((a) => (
              <div key={a.label} className="flex flex-col gap-1 rounded-md bg-sage-100 p-4">
                <p className="text-small font-semibold text-text-muted">{a.label}</p>
                <address className="flex flex-col text-body not-italic">
                  {a.lines.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </address>
                {a.note && <p className="text-small text-text-muted">{a.note}</p>}
              </div>
            ))}
            {s.links?.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener" className={linkClass}>
                {l.label}
                <ArrowSquareOutIcon size={24} weight="regular" aria-hidden className="shrink-0" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
            {s.small?.map((t) => (
              <p key={t} className="text-small text-text-muted">
                {t}
              </p>
            ))}
            <p className="text-small text-text-muted">{s.source}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 pt-8">
        <SecondaryButton onClick={onClose}>Done</SecondaryButton>
      </div>
    </BottomSheet>
  )
}
