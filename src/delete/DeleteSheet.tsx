import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/SecondaryButton'
import { DELETE_COPY, type DeleteScope } from '../flow/deletion'
import { navigate } from '../lib/router'
import { deleteData, forgetAnswers } from './deleteData'

export const DELETED_PATH = '/deleted'

// The confirmation sheet for "Delete tax forms only" and "Delete everything" (same sheet as the others: title, X, buttons).
// Lists what goes, says "This can't be undone", a red confirm button and a plain Cancel (not cobalt: the screen's
// cobalt stays for its one primary action). Nothing is called "deleted" until the server confirms; if it fails, the
// sheet says so and offers Try again, and nothing was forgotten here. Render inside <AnimatePresence>.
// While it works: the buttons are locked, the status is announced, and Escape / the X wait.
export function DeleteSheet({ scope, onClose }: { scope: DeleteScope; onClose: () => void }) {
  const copy = DELETE_COPY[scope]
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (state === 'error') errorRef.current?.focus()
  }, [state])

  const confirm = async () => {
    setState('working')
    try {
      const count = await deleteData(scope)
      // Go to the confirmation first, then forget the answers here (so this page doesn't redraw as "new" underneath)
      navigate(DELETED_PATH, { deleted: scope, count })
      forgetAnswers(scope)
    } catch {
      setState('error')
    }
  }

  return (
    <BottomSheet title={copy.title} onClose={() => state !== 'working' && onClose()}>
      <p className="text-body text-text-muted">This will delete:</p>
      <ul className="flex list-disc flex-col gap-1 pt-2 pl-6 text-body">
        {copy.will.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {copy.keeps && <p className="pt-4 text-body text-text-muted">{copy.keeps}</p>}
      <p className="pt-4 text-body font-semibold">This can’t be undone.</p>

      {/* Always in the page, so each change is announced */}
      <p role="status" aria-live="polite" className="sr-only">
        {state === 'working' ? `${copy.deleting}…` : ''}
      </p>
      {state === 'error' && (
        <p ref={errorRef} role="alert" tabIndex={-1} className="pt-4 text-body text-error outline-none">
          We couldn’t delete them. Nothing has been deleted. Please try again.
        </p>
      )}

      <div className="flex flex-col gap-2 pt-8">
        <SecondaryButton tone="destructive" disabled={state === 'working'} onClick={confirm}>
          {state === 'working' ? 'Deleting…' : state === 'error' ? 'Try again' : copy.button}
        </SecondaryButton>
        <SecondaryButton disabled={state === 'working'} onClick={onClose}>
          Cancel
        </SecondaryButton>
      </div>
    </BottomSheet>
  )
}
