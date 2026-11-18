import { CheckIcon, CircleDashedIcon, ClockIcon, DownloadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { BottomSheet } from '../components/BottomSheet'
import { Logo } from '../components/Logo'
import { PrimaryButton } from '../components/PrimaryButton'
import { ProgressRow } from '../components/ProgressRow'
import { SecondaryButton } from '../components/SecondaryButton'
import { PREVIOUS_TAX_YEARS, PRIVACY_LINE, TAX_YEAR } from '../config'
import { OUT_OF_SCOPE } from '../residency.config'
import { art, type Art } from '../data/income'
import { setFilingYear, useAllReturns } from '../flow/answers'
import { documentHref, documentsLine, incomeItemsLine } from '../flow/requiredDocuments'
import { resumeTarget } from '../flow/screens'
import { spring } from '../lib/motion'
import { Link, navigate } from '../lib/router'
import { useExtraction } from '../extraction/client'
import { homeFixture, homeReadingFixture } from './fixtures'
import { returnStatus, type HomeState, type ReturnStatus } from './returnStatus'
import { OtherWaysToFile } from '../residency/OtherWaysToFile'
import { DoneCard } from './DoneCard'

// Home: the landing screen for everyone who's logged in, in every state of
// their return (returnStatus() decides: new, in-progress, needs-documents,
// ready, not-supported). ?home=new|progress|documents|ready|notsupported shows a test state.
//
// Layout (12-column grid): phone one column; iPad 5 + 3 columns; laptop 8 + 4.
//   main  hero card (the one cobalt button, then "Filing for an earlier year?"
//         as a secondary button) · the state's main card
//   side  the state's side cards · privacy line
// The hero and the side column start on the same top edge.
// Cards: white surface, radius lg, shadow (hero: shadow 2, others: shadow 1), padding 24 (32 for the hero from 600px).
// Motion: the hero rises in, cards stagger in, the progress row fills once;
// when the state changes the hero's text and button cross-fade. Reduced: fades.
// Copy: plain words, no jargon, no time estimates, no promises. TODO confirm all copy.

const linkClass =
  'flex min-h-11 items-center rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

// TODO confirm: hero sentences
const SENTENCE: Record<HomeState, (s: ReturnStatus) => string> = {
  new: () => 'We’ll go through it together, one question at a time.',
  'in-progress': () => 'Your answers are saved as you go.',
  'needs-documents': (s) => [documentsLine(s.documents), incomeItemsLine(s.documents)].filter(Boolean).join(' · '),
  'reading-failed': (s) => s.sentence ?? '',
  ready: () => 'Your forms are ready to download.',
  'not-supported': (s) => s.sentence ?? OUT_OF_SCOPE.body,
}

// TODO confirm: generic, "may" (no statuses, no uploads here)
const THINGS: { title: string; body: string; art: Art }[] = [
  { title: 'Passport and I-20', body: 'You may need details from these.', art: art('scholarship') },
  { title: 'Your W-2 or 1042-S', body: 'If you had a job or a scholarship, you may get one of these.', art: art('contract') },
  // TODO: a travel illustration would fit better; the passport stands in
  { title: 'Travel history', body: 'Your trips in and out of the U.S. You can get it from the I-94 website.', art: art('optcpt') },
]

// TODO: real forms (Review isn't built). Plain names, no form numbers.
const FORMS = ['Your tax return', 'Your days in the U.S. statement']

export default function HomePage() {
  const returns = useAllReturns()
  const fixture = homeFixture()
  const answers = fixture ?? returns[TAX_YEAR] ?? {}
  // Live reading status (or a pretend one for ?home=readfailed)
  const liveReading = useExtraction()
  const status = returnStatus(answers, TAX_YEAR, homeReadingFixture() ?? (fixture ? undefined : liveReading))
  const reduce = useReducedMotionConfig() ?? false
  const [earlier, setEarlier] = useState(false)
  const card = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? spring.fade : { ...spring.soft, delay: 0.08 + i * 0.06 },
  })

  useEffect(() => {
    document.title = 'Home · AtlasTax'
    // Arriving from somewhere whose button went away (e.g. the intro): focus the headline
    if (!document.activeElement || document.activeElement === document.body) document.getElementById('home-title')?.focus({ preventScroll: true })
  }, [])

  const go = (t: ReturnStatus['buttonTarget']) => {
    setFilingYear(TAX_YEAR)
    navigate(t.path, t.state)
  }
  const openYear = (year: number) => {
    setFilingYear(year)
    const t = resumeTarget(returns[year] ?? {}, year)
    navigate(t.path, t.state)
  }

  const current = status.state === 'ready' ? null : status.progress.position.section

  const yourAnswers = (i: number, footer?: ReactNode) => (
    <Card key="answers" id="home-answers" title="Your answers" motionProps={card(i)}>
      <dl className="flex flex-col divide-y divide-border-decorative">
        {status.answers.map((r) => (
          <div key={r.label} className="flex min-h-14 items-center justify-between gap-4 py-1">
            <div className="flex min-w-0 flex-col">
              <dt className="text-small text-text-muted">{r.label}</dt>
              <dd className={`text-body ${r.value ? '' : 'text-text-muted'}`}>{r.value ?? 'Not answered yet'}</dd>
            </div>
            <Link href={r.edit} className={`min-w-11 shrink-0 justify-center ${linkClass}`}>
              {r.value ? 'Edit' : 'Add'}
              <span className="sr-only"> {r.label.toLowerCase()}</span>
            </Link>
          </div>
        ))}
      </dl>
      {footer}
    </Card>
  )

  const main: ReactNode[] = []
  const side: ReactNode[] = []
  if (status.state === 'not-supported') {
    main.push(
      <Card key="other" id="home-other" title="Other ways to file" motionProps={card(1)}>
        <OtherWaysToFile />
      </Card>,
    )
  }
  if (status.state === 'new') {
    side.push(
      <Card key="things" id="home-things" title="Things you may need" motionProps={card(1)}>
        <p className="text-small text-text-muted">You don’t need them yet. It may help to have them nearby.</p>
        <ul className="flex flex-col gap-3">
          {THINGS.map((t) => (
            <li key={t.title} className="flex items-center gap-4">
              <img src={t.art.src} srcSet={t.art.srcSet} sizes="64px" alt="" width={64} height={64} loading="lazy" decoding="async" className="size-16 shrink-0 object-contain" />
              <div className="flex min-w-0 flex-col">
                <span className="text-body font-semibold">{t.title}</span>
                <span className="text-small text-text-muted">{t.body}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>,
    )
  }
  if (status.state === 'in-progress') {
    main.push(
      <Card key="next" id="home-next" title="What’s next" motionProps={card(1)}>
        <ol className="flex flex-col divide-y divide-border-decorative">
          {status.nextSteps.map((n, i) => (
            <li key={n.label} className="flex min-h-14 items-center gap-3 py-1">
              <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-full text-small font-semibold tabular-nums ${i === 0 ? 'bg-text text-on-primary' : 'bg-sage-100'}`}>
                {i + 1}
              </span>
              <Link href={n.target.path} onClick={() => setFilingYear(TAX_YEAR)} className={linkClass}>
                {n.label}
              </Link>
            </li>
          ))}
        </ol>
      </Card>,
    )
    side.push(yourAnswers(2))
  }
  if (status.state === 'needs-documents') {
    const outstanding = status.items.filter((i) => (i.kind === 'document' ? i.status === 'missing' && !i.optional : i.status === 'details-needed'))
    const later = status.items.filter((i) => i.status === 'later')
    main.push(
      <Card key="missing" id="home-missing" title="What’s missing" motionProps={card(1)}>
        <ul className="flex flex-col divide-y divide-border-decorative">
          {outstanding.map((i) => (
            <li key={i.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 py-1">
              <Link href={documentHref(i.id)} className={linkClass}>
                {i.kind === 'document' ? i.form : i.incomeLabel}
              </Link>
              <span className="flex items-center gap-2 text-small">
                <CircleDashedIcon size={24} weight="regular" aria-hidden />
                {i.kind === 'document' ? 'Not added yet' : 'Details needed'}
              </span>
            </li>
          ))}
        </ul>
        {later.length > 0 && (
          <p className="flex items-start gap-2 text-small text-text-muted">
            <ClockIcon size={24} weight="regular" aria-hidden className="shrink-0" />
            You’ll add later: {later.map((i) => (i.kind === 'document' ? i.form : i.incomeLabel)).join(', ')}
          </p>
        )}
      </Card>,
    )
    side.push(
      <Card key="docs" id="home-docs" title="Documents" motionProps={card(2)}>
        <p className="flex items-center gap-2 text-body font-semibold tabular-nums">
          {status.documents.documents.missing === 0 ? <CheckIcon size={24} weight="regular" aria-hidden /> : <CircleDashedIcon size={24} weight="regular" aria-hidden />}
          {documentsLine(status.documents)}
        </p>
        {status.documents.documents.total > 0 && <Bar value={status.documents.documents.added / status.documents.documents.total} reduce={reduce} />}
        {incomeItemsLine(status.documents) && (
          <p className="flex items-center gap-2 text-body tabular-nums">
            <WarningCircleIcon size={24} weight="regular" aria-hidden />
            {incomeItemsLine(status.documents)}
          </p>
        )}
        <Link href="/documents" className={`self-start ${linkClass}`}>
          View documents
        </Link>
      </Card>,
      yourAnswers(3),
    )
  }
  if (status.state === 'reading-failed') {
    side.push(yourAnswers(1))
  }
  if (status.state === 'ready') {
    main.push(
      <Card key="forms" id="home-forms" title="Your forms" motionProps={card(1)}>
        <ul className="flex flex-col divide-y divide-border-decorative">
          {FORMS.map((f) => (
            <li key={f} className="flex min-h-14 items-center justify-between gap-4 py-1">
              <span className="flex items-center gap-2 text-body">
                <CheckIcon size={24} weight="regular" aria-hidden />
                {f}
              </span>
              {/* TODO: real PDF downloads */}
              <button
                type="button"
                className="flex h-11 shrink-0 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold active:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                <DownloadSimpleIcon size={24} weight="regular" aria-hidden />
                PDF<span className="sr-only">: {f}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>,
    )
    side.push(
      yourAnswers(
        2,
        <Link href="/visa" onClick={() => setFilingYear(TAX_YEAR)} className={`self-start ${linkClass}`}>
          Review again
        </Link>,
      ),
    )
  }

  // The return is done (E-file celebration reached) and the card wasn't dismissed: what to do with the documents
  const showDone = !fixture && !!answers.returnDone && !answers.doneCardDismissed

  return (
    <AppShell title={<Logo settle />} activeTab="home">
      <div className="page-x">
        <div className="page-content page-grid items-start gap-y-6 pt-6 pb-12 tablet:pt-8">
          {fixture && (
            <p className="col-span-full text-small text-text-muted">
              Test state: {new URLSearchParams(window.location.search).get('home')} (from the address). Your saved answers aren’t changed.
            </p>
          )}

          <div className="col-span-full flex flex-col gap-6 tablet:col-span-5 desktop:col-span-8">
            {/* Hero: the one focal point and the only cobalt element */}
            <motion.section
              aria-labelledby="home-title"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? spring.fade : spring.soft}
              className="flex flex-col gap-6 rounded-lg bg-surface p-6 shadow-2 tablet:p-8"
            >
              <div className="flex flex-col gap-2">
                <p className="text-small text-text-muted">{TAX_YEAR} tax return</p>
                <div className="flex min-w-0 flex-col gap-2">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={status.state} className="flex flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.quick}>
                      <h1 id="home-title" tabIndex={-1} className="font-display text-display text-balance outline-none">
                        {status.headline}
                      </h1>
                      <p className="text-body text-text-muted tabular-nums">{SENTENCE[status.state](status)}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              {status.state !== 'not-supported' && <ProgressRow done={status.progress.done} current={current} />}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={status.state} className="flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.quick}>
                  <PrimaryButton onClick={() => go(status.buttonTarget)}>{status.buttonLabel}</PrimaryButton>
                </motion.div>
              </AnimatePresence>
              {/* Secondary, right under the cobalt button: no outline, cobalt label (designer's call); opens the earlier-years sheet */}
              {PREVIOUS_TAX_YEARS.length > 0 && (
                <div className="-mt-4 flex flex-col">
                  <SecondaryButton tone="quiet" onClick={() => setEarlier(true)}>Filing for an earlier year?</SecondaryButton>
                </div>
              )}
            </motion.section>
            {showDone && <DoneCard motionProps={card(0)} />}
            {main}
          </div>

          <div className="col-span-full flex flex-col gap-6 tablet:col-span-3 desktop:col-span-4">
            {side}
            {PRIVACY_LINE && <p className="text-small text-text-muted">{PRIVACY_LINE}</p>}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {earlier && (
          <BottomSheet title="Filing for an earlier year?" onClose={() => setEarlier(false)}>
            <p className="text-body text-text-muted">Pick the year you’re filing for. Each year keeps its own answers.</p>
            <ul className="flex flex-col gap-2 pt-6">
              {PREVIOUS_TAX_YEARS.map((y) => (
                <li key={y} className="flex flex-col">
                  <SecondaryButton onClick={() => openYear(y)}>
                    <span className="tabular-nums">{y} tax return</span>
                  </SecondaryButton>
                </li>
              ))}
            </ul>
          </BottomSheet>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

/** A white card that's a labelled region. */
function Card({ id, title, children, motionProps }: { id: string; title: string; children: ReactNode; motionProps: object }) {
  return (
    <motion.section {...motionProps} aria-labelledby={id} className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-1">
      <h2 id={id} className="font-display text-title">
        {title}
      </h2>
      {children}
    </motion.section>
  )
}

/** Thin navy bar (decorative; the line above says it). */
function Bar({ value, reduce }: { value: number; reduce: boolean }) {
  return (
    <span aria-hidden className="flex h-1 overflow-hidden rounded-full bg-border-decorative">
      <motion.span
        className="w-full origin-left rounded-full bg-text"
        initial={{ scaleX: reduce ? value : 0 }}
        animate={{ scaleX: value }}
        transition={reduce ? spring.fade : { ...spring.soft, delay: 0.3 }}
      />
    </span>
  )
}
