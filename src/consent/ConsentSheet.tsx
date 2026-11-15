import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { CONSENT_COPY as copy } from '../consent.config'

// The consent notice as a bottom sheet (EXTRACTION-PLAN.md §4). Render it inside <AnimatePresence>.
//   mode "ask"   shown before the first upload: one cobalt button ("Continue to
//                upload") and a quiet "Not now". The X, Escape and a tap outside
//                all mean "Not now".
//   mode "read"  from Profile: the same words, read-only, one Close.
// The words live in src/consent.config.ts (placeholders, TODO confirm with legal).
// Layout: lead, then a labelled list (term in semibold, sentence in muted body),
// a quiet link to the full notice, then the buttons 8 apart, like every sheet.

type Props =
  | { mode: 'ask'; onAgree: () => Promise<boolean>; onDecline: () => void }
  | { mode: 'read'; onClose: () => void }

export function ConsentSheet(props: Props) {
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const ask = props.mode === 'ask'

  const agree = async () => {
    if (!ask || saving) return
    setSaving(true)
    setFailed(false)
    const ok = await props.onAgree()
    // On success the host closes the sheet; on failure stay and say so
    if (!ok) {
      setSaving(false)
      setFailed(true)
    }
  }

  return (
    <BottomSheet title={copy.title} onClose={ask ? props.onDecline : props.onClose}>
      <p className="text-body text-text-muted">{copy.lead}</p>
      <dl className="flex flex-col gap-4 pt-6">
        {copy.rows.map((r) => (
          <div key={r.label} className="flex flex-col">
            <dt className="text-body font-semibold">{r.label}</dt>
            <dd className="text-body text-text-muted">{r.text}</dd>
          </div>
        ))}
      </dl>
      <a
        href={copy.linkHref}
        target="_blank"
        rel="noopener"
        className="mt-4 flex min-h-11 items-center gap-1 self-start rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        {copy.link}
        <ArrowSquareOutIcon size={24} weight="regular" aria-hidden className="shrink-0" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {failed && (
        <p role="alert" className="pt-4 text-body text-error">
          We couldn’t save that. Check your connection and try again.
        </p>
      )}
      <div className="flex flex-col gap-2 pt-8">
        {ask ? (
          <>
            {/* Not disabled while saving: a disabled button loses focus (it would fall to the page); agree() ignores a second press */}
            <PrimaryButton onClick={() => void agree()}>
              {copy.accept}
            </PrimaryButton>
            <SecondaryButton onClick={props.onDecline}>{copy.decline}</SecondaryButton>
          </>
        ) : (
          <SecondaryButton onClick={props.onClose}>{copy.close}</SecondaryButton>
        )}
      </div>
    </BottomSheet>
  )
}
