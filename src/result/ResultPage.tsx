import { CheckCircleIcon, CircleDashedIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { ESTIMATE_NUMBER_VISIBLE } from '../config'
import { usStates } from '../data/places'
import { useAnswers, useFilingYear, type Answers } from '../flow/answers'
import { EFILE_PATH, REVIEW_PATH } from '../flow/screens'
import { spring } from '../lib/motion'
import { Link, navigate } from '../lib/router'
import { downloadForm } from '../forms/client'
import { NextStepsSheet } from './NextStepsSheet'
import { fetchEstimate } from '../tax/client'
import { combined, ESTIMATE_LABEL, hideNumbers, isCalculated, type Calculated, type Estimate, type EstimateLine, type FormStatus, type LineGroup, type Section } from '../tax/estimate'
import type { Target } from '../tax/input'
import { isResultFixture, type ResultFixture } from '../tax/fixtureNames'

// /result: after Review's "Looks good". The flow ends here. Plan: AFTER-DOCUMENTS-PLAN.md §7.
// The page reads ONE thing, the engine's `Estimate` (src/tax/estimate.ts), and decides nothing
// about tax. It never makes up a number: a section the engine can't do yet says "Not calculated
// yet" and what's missing. Anything unconfirmed shows what's blocking, with a link to fix it.
//   Federal and State sections: refund (calm, positive), amount owed (neutral, practical), or not
//   calculated / not supported. "Show how we got this" lists the lines. A combined total only
//   when both are calculated. Notes: single filing status, treaty benefits not included.
//   Downloads: Form 8843 and Form 1040-NR (src/forms, server/forms.ts): a Download button when a form can be
//   prepared (filled on the server per click, never saved or logged, every page marked "Prototype estimate, not
//   for filing"), and why a form isn't ready.
//   "Show estimate number" (prototype switch, this browser only): off = no amount anywhere.
// Recalculates every time it opens and whenever the answers change while it's open.
// Dev: ?result=refund|owed|blocked|waiting shows labelled TEST inputs (fixtures.ts) instead.
// Layout: same grid as Home: one column on phone, 5 + 3 columns on iPad, 8 + 4 on laptop.

const HEADING_ID = 'result-title'
const linkClass =
  'flex min-h-11 items-center rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

const usd = (cents: number | null) => (cents === null ? 'Hidden in this prototype' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100))

export default function ResultPage() {
  const answers = useAnswers()
  const year = useFilingYear()
  const reduce = useReducedMotionConfig() ?? false
  const showNumber = ESTIMATE_NUMBER_VISIBLE // the on-screen switch is gone; the server setting still decides (src/config.ts)

  // Dev test inputs (read once)
  const [fixture] = useState<ResultFixture | null>(() => {
    const q = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('result') : null
    return isResultFixture(q) ? q : null
  })

  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [announce, setAnnounce] = useState('')
  // "What to do next" slides up after EVERY download (once per download), with a close button
  const [nextOpen, setNextOpen] = useState(false)
  const last = useRef<string | null>(null)
  // What the estimate depends on in the browser (documents and answers): a change recalculates it
  const sig = JSON.stringify([answers.income, answers.details, answers.citizenship, answers.visa, answers.state, answers.residency, answers.livedBefore, answers.marital, answers.digitalAssets])

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        let e: Estimate
        if (fixture && import.meta.env.DEV) {
          e = (await import('../tax/fixtures')).RESULT_SAMPLES[fixture]
          if (!showNumber) e = hideNumbers(e)
        } else e = await fetchEstimate(year, answers, showNumber)
        if (!live) return
        const text = JSON.stringify(e)
        if (last.current !== null && last.current !== text) setAnnounce('Estimate updated')
        last.current = text
        setFailed(false)
        setEstimate(e)
      } catch {
        if (live) setFailed(true)
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` stands for the answers
  }, [year, sig, showNumber, fixture, attempt])

  const ready = estimate !== null
  useEffect(() => {
    document.title = 'Your estimate · AtlasTax'
  }, [])
  useEffect(() => {
    if (ready || failed) document.getElementById(HEADING_ID)?.focus({ preventScroll: true })
  }, [ready, failed])

  const card = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? spring.fade : { ...spring.soft, delay: 0.06 + i * 0.06 },
  })

  const blocked = !!estimate && estimate.blockers.length > 0
  const total = estimate ? (showNumber ? combined(estimate) : null) : null

  return (
    <AppShell
      title={`${year} tax return`}
      backHref={REVIEW_PATH}
      backState={{ doc: 'summary' }}
      activeTab="home"
      action={
        <Link href="/" className="flex min-h-11 items-center rounded-sm text-small font-semibold whitespace-nowrap underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
          Save and exit
        </Link>
      }
    >
      <div className="page-x">
        <div className="page-content page-grid items-start gap-y-6 pt-6 pb-12 tablet:pt-8">
          {fixture && (
            <p className="col-span-full text-small text-text-muted">
              Test input “{fixture}” (from the address): sample numbers to check the screen. They are not calculated and not your return.
            </p>
          )}

          {failed && !estimate && (
            <div className="col-span-full flex max-w-sm flex-col gap-4">
              <h1 id={HEADING_ID} tabIndex={-1} className="font-display text-display outline-none">
                Your estimate
              </h1>
              <p className="text-body">We couldn’t load your estimate.</p>
              <SecondaryButton onClick={() => setAttempt((n) => n + 1)}>Try again</SecondaryButton>
            </div>
          )}

          {estimate && (
            <>
              <div className="col-span-full flex flex-col gap-2 tablet:col-span-6 desktop:col-span-8">
                <p className="text-small text-text-muted">{year} tax return</p>
                <h1 id={HEADING_ID} tabIndex={-1} className="font-display text-display text-balance outline-none">
                  {blocked ? 'We can’t give an estimate yet' : 'Your estimate'}
                </h1>
              </div>

              <div className="col-span-full flex flex-col gap-6 tablet:col-span-5 desktop:col-span-8">
                {blocked && (
                  <Card id="result-blocked" title="What’s in the way" motionProps={card(0)}>
                    <ul className="flex flex-col divide-y divide-border-decorative">
                      {estimate.blockers.map((b) => (
                        <li key={b.id} className="flex flex-col items-start gap-1 py-3 first:pt-0 last:pb-0">
                          <span className="text-body">{b.reason}</span>
                          <TargetLink target={b.fix.target}>{b.fix.label}</TargetLink>
                        </li>
                      ))}
                    </ul>
                    <PrimaryButton onClick={() => navigate(estimate.blockers[0].fix.target.path, estimate.blockers[0].fix.target.state)}>Fix what’s missing</PrimaryButton>
                  </Card>
                )}

                <SectionCard id="result-federal" title="Federal" section={estimate.federal} card={card(1)} reduce={reduce} />
                <SectionCard id="result-state" title={stateTitle(estimate.state.code)} section={estimate.state} card={card(2)} reduce={reduce} />

                {total && (
                  <Card id="result-total" title="Federal and state together" motionProps={card(3)}>
                    <Outcome status={total.status} amount={total.amount} what="together" />
                  </Card>
                )}
              </div>

              <div className="col-span-full flex flex-col gap-6 tablet:col-span-3 desktop:col-span-4">
                <Card id="result-downloads" title="Download your forms" motionProps={card(1)}>
                  <ul className="flex flex-col divide-y divide-border-decorative">
                    {estimate.forms.map((f) => (
                      <DownloadRow key={f.id} form={f} year={year} answers={answers} numbers={showNumber && !fixture} tellMe={setAnnounce} onDownloaded={() => setNextOpen(true)} />
                    ))}
                  </ul>
                  {/* One "How to mail it" for both forms, above the e-file option: opens "What to do next" without downloading */}
                  <button type="button" onClick={() => setNextOpen(true)} className={`self-start ${linkClass}`}>
                    How to mail it
                  </button>
                  <EfileLine />
                </Card>
                <Card id="result-details" title="Your details" motionProps={card(2)}>
                  <p className="text-small text-text-muted">Change anything you confirmed, and this estimate updates.</p>
                  <TargetLink target={{ path: REVIEW_PATH, state: { doc: 'summary' } }}>Check your details</TargetLink>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <AnimatePresence>{nextOpen && estimate && <NextStepsSheet key="next-steps" estimate={estimate} onClose={() => setNextOpen(false)} />}</AnimatePresence>
    </AppShell>
  )
}

const stateTitle = (code: string | null) => {
  const name = code ? usStates.find((p) => p.value === code)?.label : undefined
  return name ? `State: ${name}` : 'State'
}

/**
 * One form in "Download your forms": its status and a Download button when it can be prepared
 * (what the form leaves blank is on the form's last page, not on this screen).
 * The PDF is made on the server per click and never saved there; here it is only handed to the browser's download.
 */
function DownloadRow({ form, year, answers, numbers, tellMe, onDownloaded }: { form: FormStatus; year: number; answers: Answers; numbers: boolean; tellMe: (text: string) => void; onDownloaded: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const ready = form.status === 'ready'
  const name = form.label.replace(/(\S)-(?=\S)/g, '$1⁠-⁠')

  const run = async () => {
    if (busy) return // not disabled while busy: a disabled button would lose keyboard focus
    setBusy(true)
    setFailed(false)
    const result = await downloadForm(form.id, year, answers, numbers)
    setBusy(false)
    if (result === 'done') {
      tellMe(`${form.label} downloaded`)
      onDownloaded()
    } else setFailed(true)
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-body font-semibold">{name}</span>
        <span className="flex items-center gap-2 text-small font-semibold whitespace-nowrap">
          {ready ? <CheckCircleIcon size={24} weight="regular" aria-hidden /> : <CircleDashedIcon size={24} weight="regular" aria-hidden />}
          {ready ? 'Ready' : 'Not ready yet'}
        </span>
      </div>
      {!ready && form.reason && <p className="text-small text-text-muted">{form.reason}</p>}
      {ready && (
        <>
          <SecondaryButton onClick={() => void run()}>
            {busy ? 'Preparing…' : 'Download'}
            <span className="sr-only"> {form.label}</span>
          </SecondaryButton>
          {failed && (
            <p role="alert" className="text-small text-error">
              We couldn’t prepare this form. Try again.
            </p>
          )}
        </>
      )}
    </li>
  )
}

/** "Want to e-file instead?": opens the E-file concept screen (not connected to the IRS: src/result/EfilePage.tsx). */
function EfileLine() {
  return (
    <div className="flex flex-col gap-3 border-t border-border-decorative pt-4">
      <p className="text-body">
        Want to e-file instead?
      </p>
      <PrimaryButton onClick={() => navigate(EFILE_PATH)}>E-file</PrimaryButton>
    </div>
  )
}

function TargetLink({ target, children }: { target: Target; children: ReactNode }) {
  return (
    <a
      href={target.path}
      onClick={(e) => {
        e.preventDefault()
        navigate(target.path, target.state)
      }}
      className={linkClass}
    >
      {children}
    </a>
  )
}

export function Card({ id, title, children, motionProps }: { id: string; title: string; children: ReactNode; motionProps: object }) {
  return (
    <motion.section {...motionProps} aria-labelledby={id} className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-1">
      <h2 id={id} className="font-display text-title">
        {title}
      </h2>
      {children}
    </motion.section>
  )
}

/** The big moment: refund is calm and positive (success check), owed is neutral (no red, no alarm). */
export function Outcome({ status, amount, what }: { status: 'refund' | 'owed' | 'zero'; amount: number | null; what: string }) {
  if (status === 'zero') return <p className="text-body">We estimate you owe nothing {what === 'together' ? 'overall' : ''}, and no refund is due.</p>
  const refund = status === 'refund'
  return (
    <div className="flex flex-col gap-1">
      <p className={`flex items-center gap-2 text-body ${refund ? 'font-semibold text-success' : ''}`}>
        {refund && <CheckCircleIcon size={24} weight="regular" aria-hidden />}
        {refund ? 'We estimate a refund of' : 'We estimate you owe'}
      </p>
      <p className={`tabular-nums ${amount === null ? 'text-body text-text-muted' : 'font-display text-display'}`}>{usd(amount)}</p>
    </div>
  )
}

function SectionCard({ id, title, section, card, reduce }: { id: string; title: string; section: Section; card: object; reduce: boolean }) {
  return (
    <Card id={id} title={title} motionProps={card}>
      <p className="text-small font-semibold text-text-muted">{ESTIMATE_LABEL}</p>
      {isCalculated(section) ? (
        <>
          <Outcome status={section.status} amount={section.amount} what="" />
          <Breakdown section={section} reduce={reduce} id={id} />
        </>
      ) : section.status === 'not-calculated' ? (
        <div className="flex flex-col gap-2">
          <p className="text-body font-semibold">Not calculated yet</p>
          <ul className="flex flex-col gap-1 text-body">
            {section.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : section.status === 'no-tax' ? (
        <p className="text-body">{section.message}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-body">{section.message}</p>
          {section.withheld !== undefined && <p className="text-body tabular-nums">Withheld from your pay: {usd(section.withheld)}</p>}
        </div>
      )}
    </Card>
  )
}

const GROUPS: [LineGroup, string][] = [
  ['income', 'Income'],
  ['deductions', 'Deductions'],
  ['tax', 'Tax'],
  ['payments', 'Payments'],
  ['result', 'Result'],
]

/** "Show how we got this": each line, grouped, with where it came from and the figures used. */
function Breakdown({ section, reduce, id }: { section: Calculated; reduce: boolean; id: string }) {
  const [open, setOpen] = useState(false)
  const panel = `${id}-how`
  return (
    <div className="flex flex-col gap-4">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)} className={`self-start ${linkClass}`}>
        {open ? 'Hide how we got this' : 'Show how we got this'}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panel}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0, transition: reduce ? spring.fade : spring.soft }}
            exit={{ opacity: 0, transition: spring.fade }}
            className="flex flex-col gap-6"
          >
            {GROUPS.map(([g, name]) => {
              const rows = section.lines.filter((l) => l.group === g)
              return rows.length ? (
                <section key={g} aria-label={name} className="flex flex-col">
                  <h3 className="text-small font-semibold text-text-muted">{name}</h3>
                  <ul className="flex flex-col divide-y divide-border-decorative">
                    {rows.map((l) => (
                      <LineRow key={l.id} line={l} />
                    ))}
                  </ul>
                </section>
              ) : null
            })}
            {section.sources.length > 0 && (
              <section aria-label="Figures used" className="flex flex-col gap-1">
                <h3 className="text-small font-semibold text-text-muted">Figures used</h3>
                <ul className="flex flex-col text-small">
                  {section.sources.map((s) => (
                    <li key={s.table + s.citation}>
                      {s.table}: {s.citation}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LineRow({ line }: { line: EstimateLine }) {
  return (
    <li className="flex min-h-14 items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-body">{line.label}</span>
        {(line.formLine || line.from) && <span className="text-small text-text-muted">{[line.formLine, line.from].filter(Boolean).join(' · ')}</span>}
        {line.source && <span className="text-small text-text-muted">{line.source}</span>}
      </div>
      <span className="shrink-0 text-body tabular-nums">{usd(line.amount)}</span>
    </li>
  )
}
