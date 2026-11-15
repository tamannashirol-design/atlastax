import { AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Logo } from '../components/Logo'
import { FlowStepper } from '../components/FlowStepper'
import { PrimaryButton } from '../components/PrimaryButton'
import { PREVIOUS_TAX_YEARS, PRIVACY_LINE, TAX_YEAR } from '../config'
import { hasProgress, setFilingYear, useAllReturns } from '../flow/answers'
import { pathForSection, resumeTarget } from '../flow/screens'
import { Intro, type IntroExit } from '../intro/Intro'
import { navigate } from '../lib/router'

// Home, for returning users. One primary action:
//   nothing saved for TAX_YEAR → "Start your 2026 return"
//   something saved            → "Continue where you left off", with the
//                                stepper showing the section they're in
// Then a quiet row of previous years (only those enabled in config), an
// optional privacy line (config; empty until confirmed), and Help with
// "Replay intro". No how-it-works, deadlines or news.
//
// Home is for logged-in people; they never see the intro unless they replay
// it (logged-out people get the intro as the "/" page). The logo in the top
// bar settles in on the first load of each session (Logo).
//
// Layout: the question column (full width on phone; 6 columns, centered, on
// iPad and laptop), top-aligned under the top bar like an iOS large title.
//   32 · title (Display) · 8 · subtitle · 32 · [stepper card · 16] · primary
//   40 · previous years · 40 · privacy line · 40 · Help (Replay intro) · 32

const column = 'col-span-full tablet:col-span-6 tablet:col-start-2 desktop:col-start-4'
const linkClass =
  'flex min-h-11 items-center self-start rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export default function HomePage() {
  const returns = useAllReturns()
  const current = returns[TAX_YEAR]
  const inProgress = hasProgress(current)
  const resume = resumeTarget(current ?? {})
  const [intro, setIntro] = useState(false)
  const replay = useRef<HTMLButtonElement>(null)
  const afterIntro = useRef<() => void>(() => {})

  const open = (year: number) => {
    setFilingYear(year)
    const target = resumeTarget(returns[year] ?? {})
    navigate(target.path, target.state)
  }

  const closeIntro = (how: IntroExit) => {
    setIntro(false)
    // Once the intro has faded out: Get started goes into the flow (the
    // question takes focus); otherwise focus goes back to Replay intro
    afterIntro.current = how === 'start' ? () => open(TAX_YEAR) : () => replay.current?.focus()
  }

  return (
    <AppShell title={<Logo settle />} activeTab="home">
      <div className="page-x">
        <div className="page-content page-grid pt-8 pb-8">
          <div className={`flex flex-col ${column}`}>
            <h1 className="font-display text-display text-balance">Your {TAX_YEAR} tax return</h1>
            {/* TODO confirm: who the app is for (FLOW.md) */}
            <p className="mt-2 text-body text-text-muted">For students on an F‑1, J‑1 or M‑1 visa filing Form 1040‑NR.</p>

            {inProgress && (
              <div className="mt-8 flex flex-col gap-2 rounded-md border border-border-strong bg-surface px-4 py-2">
                <span className="pt-2 text-small text-text-muted">You’re in this section</span>
                <FlowStepper
                  presentation="compact"
                  position={resume.position}
                  onNavigate={(section) => {
                    setFilingYear(TAX_YEAR)
                    const target = pathForSection(section, current ?? {})
                    navigate(target.path, target.state)
                  }}
                />
              </div>
            )}

            <div className={`flex flex-col ${inProgress ? 'mt-4' : 'mt-8'}`}>
              <PrimaryButton onClick={() => open(TAX_YEAR)}>{inProgress ? 'Continue where you left off' : `Start your ${TAX_YEAR} return`}</PrimaryButton>
            </div>

            {PREVIOUS_TAX_YEARS.length > 0 && (
              <section aria-labelledby="home-previous" className="mt-10 flex flex-col gap-2">
                <h2 id="home-previous" className="text-small text-text-muted">
                  File for a previous year
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {PREVIOUS_TAX_YEARS.map((year) => {
                    const started = hasProgress(returns[year])
                    return (
                      <li key={year} className="flex">
                        <button
                          type="button"
                          onClick={() => open(year)}
                          className="flex h-11 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
                        >
                          <span className="tabular-nums">{year}</span>
                          {started && <span className="text-small font-normal text-text-muted">In progress</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {PRIVACY_LINE && <p className="mt-10 text-small text-text-muted">{PRIVACY_LINE}</p>}

            <section aria-labelledby="home-help" className="mt-10 flex flex-col gap-1">
              <h2 id="home-help" className="text-small text-text-muted">
                Help
              </h2>
              <button ref={replay} type="button" onClick={() => setIntro(true)} className={linkClass}>
                Replay intro
              </button>
            </section>
          </div>
        </div>
      </div>

      <AnimatePresence onExitComplete={() => afterIntro.current()}>{intro && <Intro onClose={closeIntro} />}</AnimatePresence>
    </AppShell>
  )
}
