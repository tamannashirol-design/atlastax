import { CheckIcon } from '@phosphor-icons/react'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { PrimaryButton } from '../components/PrimaryButton'
import { DELETE_COPY, isDeleteScope } from '../flow/deletion'
import { spring } from '../lib/motion'
import { navigate, useHistoryState } from '../lib/router'

// /deleted: shown only after the server confirmed a deletion (the sheet navigates here with { deleted, count } in the
// history state). Open directly, there is nothing to say, so it goes Home: this page never claims a deletion that didn't happen.
// Motion (transform + opacity only): a handful of generic document cards, fanned out, gather in the middle and dissolve (~1s),
// then the confirmation fades up. Reduced motion: no cards; the confirmation fades in. TODO confirm with legal: the wording.
const GATHER_MS = 1000
const HEADING_ID = 'deleted-title'

export default function DeletedPage() {
  const state = useHistoryState()
  const reduce = useReducedMotionConfig() ?? false
  const scope = isDeleteScope(state.deleted) ? state.deleted : null
  const count = typeof state.count === 'number' ? state.count : 0
  const [phase, setPhase] = useState<'gather' | 'done'>(reduce ? 'done' : 'gather')

  useEffect(() => {
    if (!scope) navigate('/', null, { replace: true })
  }, [scope])
  useEffect(() => {
    if (phase !== 'gather') return
    const t = window.setTimeout(() => setPhase('done'), GATHER_MS)
    return () => window.clearTimeout(t)
  }, [phase])
  useEffect(() => {
    if (phase === 'done') document.getElementById(HEADING_ID)?.focus({ preventScroll: true })
  }, [phase])
  useEffect(() => {
    if (scope) document.title = `${DELETE_COPY[scope].done} · AtlasTax`
  }, [scope])
  if (!scope) return null
  const copy = DELETE_COPY[scope]
  const cards = Math.min(6, Math.max(3, count))

  return (
    <AppShell title="Delete" activeTab="home">
      <div className="page-x">
        <div className="page-content flex justify-center pt-10 pb-12 tablet:pt-16">
          <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
            {phase === 'gather' && (
              // One grid cell: every card starts fanned out, then they all gather in the middle and fade (springs only)
              <div aria-hidden className="grid h-40 w-full place-items-center">
                {Array.from({ length: cards }, (_, i) => {
                  const spread = i - (cards - 1) / 2
                  return (
                    <motion.span
                      key={i}
                      className="flex h-28 w-20 flex-col gap-2 rounded-md border border-border-decorative bg-surface p-3 shadow-1 [grid-area:1/1]"
                      initial={{ x: spread * 52, y: Math.abs(spread) * 6, rotate: spread * 6, scale: 1, opacity: 1 }}
                      animate={{ x: 0, y: 0, rotate: 0, scale: 0.5, opacity: 0 }}
                      transition={{ ...spring.soft, opacity: { ...spring.quick, delay: 0.45 } }}
                    >
                      <span className="h-2 w-10 rounded-full bg-sage-100" />
                      <span className="h-2 w-12 rounded-full bg-sage-100" />
                      <span className="h-2 w-8 rounded-full bg-sage-100" />
                    </motion.span>
                  )
                })}
              </div>
            )}

            {phase === 'done' && (
              <motion.div
                className="flex w-full flex-col items-center gap-8"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? spring.fade : spring.soft}
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-success text-on-primary">
                  <CheckIcon size={32} weight="regular" aria-hidden />
                </span>
                <div className="flex flex-col items-center gap-3">
                  <h1 id={HEADING_ID} tabIndex={-1} className="font-display text-display outline-none">
                    {copy.done}
                  </h1>
                  <p className="text-body text-text-muted">{copy.doneLine}</p>
                </div>
                <div className="flex w-full flex-col">
                  <PrimaryButton onClick={() => navigate('/')}>Back to Home</PrimaryButton>
                </div>
              </motion.div>
            )}

            {/* Read out when the confirmation appears */}
            <p role="status" aria-live="polite" className="sr-only">
              {phase === 'done' ? copy.done : ''}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
