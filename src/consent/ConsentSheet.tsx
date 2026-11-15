import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import type { AgreeResult } from './client'
import type { Notice } from './logic'

// The consent notice as a bottom sheet (EXTRACTION-PLAN.md §4). Render it inside <AnimatePresence>.
//   mode "ask"   before the first upload: one cobalt button ("Continue to upload")
//                and a quiet "Not now". The X, Escape and a tap outside all mean
//                "Not now".
//   mode "read"  from Profile: the same words, read-only, one Close.
// It shows EXACTLY the notice the server sent (words, version, fingerprint), never
// words built into the app, so what's agreed to is what was on screen.
// If the notice changed while it was open, the new words replace the old ones under
// "The notice has changed" (focus moves there), and the person agrees afresh.
// Layout: [changed note], lead, a labelled list (term in semibold, sentence in muted
// body), a quiet link to the full notice, then the buttons 8 apart, like every sheet.

type Props =
  | { mode: 'ask'; notice: Notice; changed: boolean; onAgree: () => Promise<AgreeResult>; onDecline: () => void }
  | { mode: 'read'; notice?: Notice; onClose: () => void; onRetry: () => void }

export function ConsentSheet(props: Props) {
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const changedNote = useRef<HTMLDivElement>(null)
  const ask = props.mode === 'ask'
  const notice = props.notice
  const changed = ask && props.changed

  // New words arrived while the sheet was open: take the reader to the note above them
  useLayoutEffect(() => {
    if (changed) changedNote.current?.focus()
  }, [changed, notice?.fingerprint])

  const agree = async () => {
    if (!ask || saving) return
    setSaving(true)
    setFailed(false)
    const result = await props.onAgree()
    // "agreed": the host closes the sheet. "changed": the new words are now showing; nothing was recorded.
    setSaving(false)
    if (result === 'failed') setFailed(true)
  }

  if (!notice) {
    // Read mode only: we couldn't load the words
    return (
      <BottomSheet title="Privacy notice" onClose={ask ? props.onDecline : props.onClose}>
        <p role="alert" className="text-body">
          We couldn’t check your privacy settings.
        </p>
        <div className="flex flex-col gap-2 pt-8">
          {!ask && <SecondaryButton onClick={props.onRetry}>Try again</SecondaryButton>}
        </div>
      </BottomSheet>
    )
  }
  const copy = notice.copy

  return (
    <BottomSheet title={copy.title} onClose={ask ? props.onDecline : props.onClose}>
      {changed && (
        <div ref={changedNote} tabIndex={-1} role="status" className="mb-6 flex flex-col rounded-md bg-sage-100 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
          <p className="text-body font-semibold">The notice has changed</p>
          <p className="text-body text-text-muted">Read the new version below before you continue.</p>
        </div>
      )}
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
          We couldn’t save your agreement. Try again.
        </p>
      )}
      <div className="flex flex-col gap-2 pt-8">
        {ask ? (
          <>
            {/* Not disabled while saving: a disabled button loses focus (it would fall to the page); agree() ignores a second press */}
            <PrimaryButton onClick={() => void agree()}>{copy.accept}</PrimaryButton>
            <SecondaryButton onClick={props.onDecline}>{copy.decline}</SecondaryButton>
          </>
        ) : (
          <SecondaryButton onClick={props.onClose}>{copy.close}</SecondaryButton>
        )}
      </div>
    </BottomSheet>
  )
}
