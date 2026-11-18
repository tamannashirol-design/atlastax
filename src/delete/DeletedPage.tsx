import { CheckIcon } from '@phosphor-icons/react'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { DELETE_COPY, isDeleteScope } from '../flow/deletion'
import { spring } from '../lib/motion'
import { navigate, useHistoryState } from '../lib/router'
import { deleteData, forgetAnswers } from './deleteData'
import { ShredderStage, type StageCard } from './ShredderStage'

// /deleted: the shredding stage, and then the confirmation (MOTION-delete.md). The confirmation sheet opens this page with
// { deleted: scope, cards, kept } in the history state; THIS page sends the delete request the moment it opens, so the
// cards go into the shredder while the request runs.
//   "Deleted" is shown only when BOTH the last card has been shredded AND the server answered 200.
//   Server says no (at any moment): the cards come back, an error says nothing was deleted, "Try again" runs it all again.
// The browser forgets the matching answers as soon as the server confirms (never before). Opened directly, or without a
// choice in the state, it goes Home: this page never claims a deletion that didn't happen. Reload after "deleted" shows
// the confirmation again (the history state remembers it); reload before that asks the server again (harmless).
const HEADING_ID = 'deleted-title'
const cleanCards = (v: unknown): StageCard[] => (Array.isArray(v) ? v.filter((c): c is StageCard => !!c && typeof c.id === 'string' && typeof c.name === 'string') : [])

export default function DeletedPage() {
  const state = useHistoryState()
  const reduce = useReducedMotionConfig() ?? false
  const scope = isDeleteScope(state.deleted) ? state.deleted : null
  const [cards] = useState(() => cleanCards(state.cards))
  const [kept] = useState(() => cleanCards(state.kept))
  const [attempt, setAttempt] = useState(0)
  const [req, setReq] = useState<'pending' | 'ok' | 'fail'>(state.done === true ? 'ok' : 'pending')
  const [anim, setAnim] = useState(state.done === true || cards.length === 0)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const done = req === 'ok' && anim

  useEffect(() => {
    if (!scope) navigate('/', null, { replace: true })
  }, [scope])

  // The request: sent when the page opens (and again on Try again)
  useEffect(() => {
    if (!scope || state.done === true) return
    let live = true
    setReq('pending')
    deleteData(scope).then(
      (count) => {
        if (!live) return
        forgetAnswers(scope) // the server confirmed: forget the same things here
        window.history.replaceState({ deleted: scope, count, done: true }, '')
        setReq('ok')
      },
      () => live && setReq('fail'),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one request per attempt
  }, [scope, attempt])

  useEffect(() => {
    if (scope) document.title = `${done ? DELETE_COPY[scope].done : 'Deleting'} · AtlasTax`
  }, [scope, done])
  useEffect(() => {
    if (req === 'fail') errorRef.current?.focus()
    else document.getElementById(HEADING_ID)?.focus({ preventScroll: true })
  }, [req, done])

  if (!scope) return null
  const copy = DELETE_COPY[scope]
  const retry = () => {
    setAnim(cards.length === 0)
    setAttempt((n) => n + 1)
  }
  const status = done ? copy.done : req === 'fail' ? '' : `${copy.deleting}…`

  return (
    <AppShell title="Delete" activeTab="home">
      <div className="page-x">
        <div className="page-content flex justify-center pt-10 pb-12 tablet:pt-16">
          <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
            {!done && (
              <motion.div className="flex w-full flex-col items-center gap-8" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? spring.fade : spring.soft}>
                <h1 id={HEADING_ID} tabIndex={-1} className="font-display text-display outline-none">
                  {req === 'fail' ? 'We couldn’t delete them' : 'Deleting your documents'}
                </h1>
                {/* key: Try again starts a fresh stage (cards back in place, sequence from the start) */}
                <ShredderStage key={attempt} cards={cards} kept={kept} failed={req === 'fail'} reduce={reduce} onDone={() => setAnim(true)} />
                {req === 'fail' && (
                  <div className="flex w-full flex-col gap-2">
                    <p ref={errorRef} role="alert" tabIndex={-1} className="pb-2 text-body text-error outline-none">
                      Nothing has been deleted. Please try again.
                    </p>
                    <SecondaryButton onClick={retry}>Try again</SecondaryButton>
                    <SecondaryButton onClick={() => navigate('/')}>Back to Home</SecondaryButton>
                  </div>
                )}
              </motion.div>
            )}

            {done && (
              <motion.div className="flex w-full flex-col items-center gap-8" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? spring.fade : spring.soft}>
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

            {/* Always in the page, so each change is announced: "Deleting…", then "Deleted" (the error is its own alert) */}
            <p role="status" aria-live="polite" className="sr-only">
              {status}
              {!done && req !== 'fail' && cards.length > 0 ? ` ${cards.map((c) => c.name).join(', ')}.` : ''}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
