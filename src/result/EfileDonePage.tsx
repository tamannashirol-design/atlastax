import { CheckIcon } from '@phosphor-icons/react'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { AppShell } from '../components/AppShell'
import { PrimaryButton } from '../components/PrimaryButton'
import { useFilingYear } from '../flow/answers'
import { RESULT_PATH } from '../flow/screens'
import { spring } from '../lib/motion'
import { Link, navigate } from '../lib/router'
import { CONCEPT_LABEL } from './efile'

// The celebration (/result/efile/done), after "Debit or credit card", "Bank account" or "Direct deposit" on the E-file
// concept screen. Nothing is asked and nothing is sent: it is a concept. Words: never "filed", "accepted" or anything
// about the IRS confirming it; no promise about refund timing. TODO confirm with legal: the wording.
//
// Motion, about 1.5s, transform + opacity only, once (no loop):
//   0ms      the check pops in (the `pop` token)
//   250ms    the confetti bursts up and drifts down (1.25s); the headline fades up (`soft`)
// The confetti is a keyframed path (up, then down), not a spring: a spring can't draw a rise-and-fall. It is decoration only.
// Reduced motion: no confetti; the check and headline just fade in (`fade`).
const HEADING_ID = 'efile-done-title'
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'
const START = 0.25 // s, after the check begins to pop
const FLIGHT = 1.25 // s, rise and fall

// cobalt, sage, navy, soft yellow (tokens only)
const COLORS = ['var(--color-primary)', 'var(--color-border-decorative)', 'var(--color-text)', 'var(--confetti-yellow)']
// Fixed pieces (no random numbers, so it looks the same every time): angle in degrees from straight up, how high, how far it drifts
const PIECES = Array.from({ length: 28 }, (_, i) => {
  const angle = (((i * 37) % 120) - 60) * (Math.PI / 180) // -60..+60 degrees
  const power = 90 + ((i * 53) % 70) // 90..160 px
  return {
    id: i,
    color: COLORS[i % COLORS.length],
    rise: -Math.cos(angle) * power - 20,
    dx: Math.sin(angle) * power * 1.1,
    fall: 70 + ((i * 29) % 60),
    spin: (i % 2 ? 1 : -1) * (180 + ((i * 41) % 260)),
    round: i % 3 === 0,
    delay: (i % 7) * 0.02,
  }
})

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-0">
      {PIECES.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute -top-1 -left-1 block h-2 w-1 ${p.round ? 'rounded-full' : 'rounded-[1px]'}`}
          style={{ backgroundColor: p.color, opacity: 0 }}
          animate={{
            x: [0, p.dx, p.dx * 1.25],
            y: [0, p.rise, p.rise + p.fall],
            rotate: [0, p.spin * 0.6, p.spin],
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: FLIGHT, delay: START + p.delay, times: [0, 0.4, 1], ease: ['easeOut', 'easeIn'], opacity: { duration: FLIGHT, delay: START + p.delay, times: [0, 0.05, 0.7, 1] } }}
        />
      ))}
    </div>
  )
}

export default function EfileDonePage() {
  const year = useFilingYear()
  const reduce = useReducedMotionConfig() ?? false
  const headline = `Your ${year} taxes are done`

  useEffect(() => {
    document.title = `${headline} · AtlasTax`
    document.getElementById(HEADING_ID)?.focus({ preventScroll: true })
  }, [headline])

  const t = reduce ? spring.fade : spring.soft
  return (
    <AppShell title={`${year} tax return`} backHref={RESULT_PATH} activeTab="home">
      <div className="page-x">
        <div className="page-content flex justify-center pt-10 pb-12 tablet:pt-16">
          <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
            <div className="relative flex size-24 items-center justify-center">
              <motion.div
                className="flex size-24 items-center justify-center rounded-full bg-success text-on-primary"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduce ? spring.fade : spring.pop}
              >
                <CheckIcon size={48} weight="regular" aria-hidden />
              </motion.div>
              {!reduce && <Confetti />}
            </div>

            <motion.div
              className="flex flex-col items-center gap-3"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...t, delay: reduce ? 0 : START }}
            >
              <h1 id={HEADING_ID} tabIndex={-1} className="font-display text-display outline-none">
                {headline}
              </h1>
              <p className="text-body text-text-muted">Thanks for going through it with us. You can come back to your forms any time.</p>
              {/* TODO confirm with legal: wording of the concept label */}
              <p className="rounded-xs bg-sage-100 px-2 text-small text-text-muted">{CONCEPT_LABEL}</p>
            </motion.div>

            {/* Read out once when the screen opens */}
            <p role="status" aria-live="polite" className="sr-only">
              {headline}. {CONCEPT_LABEL}.
            </p>

            <div className="flex w-full flex-col gap-2">
              <PrimaryButton onClick={() => navigate('/')}>Done</PrimaryButton>
              <Link href={RESULT_PATH} className={`flex min-h-11 items-center justify-center rounded-sm text-body font-semibold underline underline-offset-4 ${focusRing}`}>
                Download my forms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
