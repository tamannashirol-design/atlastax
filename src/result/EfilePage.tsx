import { AnimatePresence, animate, motion, useMotionValue, useReducedMotionConfig, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { SecondaryButton } from '../components/SecondaryButton'
import { ESTIMATE_NUMBER_VISIBLE } from '../config'
import { useAnswers, useFilingYear } from '../flow/answers'
import { EFILE_DONE_PATH, RESULT_PATH } from '../flow/screens'
import { spring } from '../lib/motion'
import { Link, navigate } from '../lib/router'
import { fetchEstimate } from '../tax/client'
import { hideNumbers, type Estimate } from '../tax/estimate'
import { isResultFixture, type ResultFixture } from '../tax/fixtureNames'
import { CONCEPT_LABEL, efileView, type EfileOption } from './efile'
import { NextStepsSheet } from './NextStepsSheet'
import { Wallet } from './Wallet'

// The E-file CONCEPT screen (/result/efile), reached from "Want to e-file instead?" on /result.
// Not connected to the IRS: a card, bank or direct deposit option goes to the celebration (EfileDonePage); "Pay by check" and "Paper check by mail"
// open the same "What to do next" sheet. Which label, amount and options show is decided in ./efile.ts, not here.
//
// Motion on open (about 1s), transform + opacity only: a card slides into the wallet (soft, ~400ms, after a 250ms pause), then the
// amount counts up (quick, 250ms, starting at 750ms). Reduced motion: the wallet and the amount fade in (150ms), no movement,
// and the amount shows at once. The count-up changes the digits only; the number is also in the page as plain text.
const HEADING_ID = 'efile-title'
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

const usd = (cents: number | null) => (cents === null ? 'Hidden in this prototype' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100))

/** The amount, counting up from $0. Springs only (the `quick` token); no movement, so reduced motion just shows it. */
function CountUp({ cents, reduce }: { cents: number; reduce: boolean }) {
  const value = useMotionValue(reduce ? cents : 0)
  const text = useTransform(value, (v) => usd(Math.round(v / 100) * 100))
  useEffect(() => {
    if (reduce) {
      value.set(cents)
      return
    }
    const controls = animate(value, cents, { ...spring.quick, delay: 0.75 })
    return () => controls.stop()
  }, [cents, reduce, value])
  return (
    <>
      {/* The finished number is plain text for screen readers; the counting one is decoration */}
      <span className="sr-only tabular-nums">{usd(cents)}</span>
      <motion.span aria-hidden className="tabular-nums">
        {text}
      </motion.span>
    </>
  )
}

export default function EfilePage() {
  const answers = useAnswers()
  const year = useFilingYear()
  const reduce = useReducedMotionConfig() ?? false
  const [fixture] = useState<ResultFixture | null>(() => {
    const q = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('result') : null
    return isResultFixture(q) ? q : null
  })
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [leaving, setLeaving] = useState(false) // the wallet settles shut, then the celebration opens
  const [sheet, setSheet] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        let e: Estimate
        if (fixture && import.meta.env.DEV) {
          e = (await import('../tax/fixtures')).RESULT_SAMPLES[fixture]
          if (!ESTIMATE_NUMBER_VISIBLE) e = hideNumbers(e)
        } else e = await fetchEstimate(year, answers, ESTIMATE_NUMBER_VISIBLE)
        if (!live) return
        setFailed(false)
        setEstimate(e)
      } catch {
        if (live) setFailed(true)
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once on open (and on Try again)
  }, [year, fixture, attempt])

  useEffect(() => {
    document.title = 'E-file (concept) · AtlasTax'
  }, [])
  const ready = estimate !== null
  useEffect(() => {
    if (ready || failed) document.getElementById(HEADING_ID)?.focus({ preventScroll: true })
  }, [ready, failed])

  const view = estimate ? efileView(estimate) : null
  const choose = (o: EfileOption) => {
    if (o.action === 'sheet') return setSheet(true)
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => navigate(EFILE_DONE_PATH), reduce ? 0 : 200)
  }
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: reduce ? spring.fade : { ...spring.soft } }

  return (
    <AppShell
      title={`${year} tax return`}
      backHref={RESULT_PATH}
      activeTab="home"
      action={
        <Link href="/" className={`flex min-h-11 items-center rounded-sm text-small font-semibold whitespace-nowrap underline underline-offset-4 ${focusRing}`}>
          Save and exit
        </Link>
      }
    >
      <div className="page-x">
        <div className="page-content flex justify-center pt-6 pb-12 tablet:pt-8">
          <div className="flex w-full max-w-md flex-col gap-6">
            <div className="flex flex-col items-start gap-3">
              <h1 id={HEADING_ID} tabIndex={-1} className="font-display text-display outline-none">
                E-file
              </h1>
              {/* TODO confirm with legal: wording of the concept label */}
              <p className="rounded-xs bg-sage-100 px-2 text-small text-text-muted">{CONCEPT_LABEL}</p>
            </div>

            {failed && !estimate && (
              <div className="flex flex-col gap-4">
                <p className="text-body">We couldn’t load your estimate.</p>
                <SecondaryButton onClick={() => setAttempt((n) => n + 1)}>Try again</SecondaryButton>
              </div>
            )}

            {view && (
              <>
                <div className="flex flex-col items-center gap-4 rounded-lg bg-surface p-6 shadow-1">
                  <motion.div {...fade}>
                    {/* The quick settle: the wallet closes up a touch as you choose (movement only; reduced motion skips it) */}
                    <motion.div animate={leaving && !reduce ? { scale: 0.94, y: 4 } : { scale: 1, y: 0 }} transition={spring.quick}>
                      <Wallet reduce={reduce} />
                    </motion.div>
                  </motion.div>
                  {(view.kind === 'owed' || view.kind === 'refund') && (
                    <motion.div className="flex flex-col items-center gap-1 text-center" data-amount {...fade}>
                      <p className="text-body text-text-muted">{view.label}</p>
                      <p className="font-display text-display">{view.cents === null ? usd(null) : <CountUp cents={view.cents} reduce={reduce} />}</p>
                      <p className="text-small text-text-muted">Your federal estimate</p>
                    </motion.div>
                  )}
                  {(view.kind === 'none' || view.kind === 'unavailable') && (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <p className="text-body">{view.message}</p>
                      <Link href={RESULT_PATH} className={`flex min-h-11 items-center rounded-sm text-body font-semibold underline underline-offset-4 ${focusRing}`}>
                        Back to your estimate
                      </Link>
                    </div>
                  )}
                </div>

                {(view.kind === 'owed' || view.kind === 'refund') && (
                  <section aria-labelledby="efile-options" className="flex flex-col gap-3">
                    <h2 id="efile-options" className="font-display text-title">
                      {view.heading}
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {view.options
                        .filter((o) => o.id !== 'check')
                        .map((o) => (
                          <li key={o.id} className="flex">
                            <button
                              type="button"
                              onClick={() => choose(o)}
                              className={`flex min-h-14 w-full items-center justify-between gap-4 rounded-sm border border-border-strong bg-surface px-4 text-left text-body font-semibold active:bg-sage-100 ${focusRing}`}
                            >
                              {o.label}
                            </button>
                          </li>
                        ))}
                    </ul>
                    {view.options
                      .filter((o) => o.id === 'check')
                      .map((o) => (
                        <button key={o.id} type="button" onClick={() => choose(o)} className={`flex min-h-11 items-center self-start rounded-sm text-small font-semibold underline underline-offset-4 ${focusRing}`}>
                          {o.label}
                        </button>
                      ))}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>{sheet && estimate && <NextStepsSheet estimate={estimate} onClose={() => setSheet(false)} />}</AnimatePresence>
    </AppShell>
  )
}
