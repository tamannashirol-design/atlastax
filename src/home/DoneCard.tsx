import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SecondaryButton } from '../components/SecondaryButton'
import { TAX_YEAR } from '../config'
import { DeleteSheet } from '../delete/DeleteSheet'
import { setAnswers } from '../flow/answers'
import type { DeleteScope } from '../flow/deletion'

// Home, once the return is done (the E-file celebration was reached): what happens to the documents.
// "Keep my documents" just dismisses the card. The two delete buttons open the confirmation sheet; nothing is deleted
// before that sheet's own button. All three are quiet buttons: Home's one cobalt button stays the hero's.
// TODO confirm with legal: the wording, and how long documents are really kept.
export function DoneCard({ motionProps }: { motionProps: object }) {
  const [scope, setScope] = useState<DeleteScope | null>(null)
  return (
    <>
      <motion.section {...motionProps} aria-labelledby="home-done" className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-1">
        <h2 id="home-done" className="font-display text-title">
          Your <span className="tabular-nums">{TAX_YEAR}</span> return is done
        </h2>
        <p className="text-body text-text-muted">We’re keeping your documents so you can reuse some of them next year. You can delete everything any time.</p>
        <div className="flex flex-col gap-2">
          <SecondaryButton onClick={() => setAnswers({ doneCardDismissed: true })}>Keep my documents</SecondaryButton>
          <SecondaryButton onClick={() => setScope('forms')}>Delete tax forms only</SecondaryButton>
          <SecondaryButton tone="destructive" onClick={() => setScope('everything')}>
            Delete everything
          </SecondaryButton>
        </div>
      </motion.section>
      <AnimatePresence>{scope && <DeleteSheet scope={scope} onClose={() => setScope(null)} />}</AnimatePresence>
    </>
  )
}
