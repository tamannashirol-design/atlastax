import { useEffect, useState } from 'react'
import { AnswerTile } from '../components/AnswerTile'
import { AmountField } from '../components/AmountField'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import cssText from '../index.css?raw'
import { spring } from '../lib/motion'
import { Card, Outcome } from '../result/ResultPage'
import { Checkbox } from '../review/FieldRow'
import { ESTIMATE_LABEL } from '../tax/estimate'
import { parseColors } from '../tokens/colors'
import { icons, typeScale } from './tokens'

// DESIGN SYSTEM OVERVIEW: one 16:9 screen for a portfolio image. /styleguide/overview, DEVELOPMENT ONLY (not in the
// production build, like /styleguide and /motion). Static: no animation, no scrolling.
//
// A fixed 1920x1080 canvas, scaled to fit the browser window (so it looks the same at any size). On a 12-column grid:
// margins 96, gutter 24, 4pt base. Nothing is retyped: hex codes are read from src/index.css, type sizes from the type
// scale, motion from src/lib/motion.ts, and the buttons, tile, field, checkbox and result card ARE the app's components.
//
// ?bg=transparent  makes the canvas background transparent (the white cards stay), for a PNG with no background.
// To export a crisp 2x PNG:   npm run export:overview   (dev server running; writes exports/design-system-overview@2x.png,
// 3840x2160; add  -- --transparent  for the transparent one). By hand: set the browser window to 1920x1080, open the page
// with the device pixel ratio at 2 (Chrome DevTools > device toolbar > DPR 2 > "Capture screenshot"), or use a screenshot tool at 2x.
const W = 1920
const H = 1080
const colors = parseColors(cssText)

const SWATCHES: { token: string; name: string }[] = [
  { token: 'primary', name: 'Cobalt' },
  { token: 'text', name: 'Navy' },
  { token: 'text-muted', name: 'Sage text' },
  { token: 'sage-100', name: 'Sage 100' },
  { token: 'background', name: 'Background' },
  { token: 'surface', name: 'Surface' },
  { token: 'success', name: 'Success' },
  { token: 'error', name: 'Error' },
]
const ROLES: Record<string, string> = {
  Display: 'Questions and screen titles',
  Title: 'Section titles and answer codes',
  Body: 'Reading text, buttons, links',
  Small: 'Helpers, captions, descriptions',
}
const ICON_NAMES = ['House', 'FileText', 'User', 'UploadSimple', 'DownloadSimple', 'CheckCircle']
const MOTION = (['fade', 'quick', 'pop', 'soft'] as const).map((name) => ({ name, ms: Math.round(spring[name].duration * 1000), bounce: spring[name].bounce }))

const grid = 'grid grid-cols-12 gap-x-6'
const label = 'text-small font-semibold text-text-muted'

function Section({ title, className, children }: { title: string; className: string; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-6 ${className}`}>
      <h2 className="font-display text-title">{title}</h2>
      {children}
    </section>
  )
}

export default function StyleguideOverview() {
  const [scale, setScale] = useState(1)
  const transparent = new URLSearchParams(window.location.search).get('bg') === 'transparent'
  useEffect(() => {
    document.title = 'Design system overview · AtlasTax'
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    // The page itself must not scroll or show its own background around a transparent canvas
    const { overflow, background } = document.body.style
    document.body.style.overflow = 'hidden'
    if (transparent) {
      document.documentElement.style.background = 'transparent'
      document.body.style.background = 'transparent'
    }
    return () => {
      window.removeEventListener('resize', fit)
      document.body.style.overflow = overflow
      document.body.style.background = background
      document.documentElement.style.background = ''
    }
  }, [transparent])

  const shown = ICON_NAMES.map((n) => icons.find((i) => i.name === n)).filter((i): i is (typeof icons)[number] => !!i)

  return (
    <div className="fixed inset-0 overflow-hidden">
      <main
        data-canvas
        className={`absolute top-1/2 left-1/2 flex flex-col px-24 pt-14 pb-12 ${transparent ? '' : 'bg-background shadow-3'}`}
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <h1 className="font-display text-display">AtlasTax design system</h1>

        <div className={`${grid} mt-12 gap-y-14`}>
          {/* 1. Colors */}
          <Section title="Colors" className="col-span-7">
            <ul className="grid grid-cols-4 gap-x-4 gap-y-6">
              {SWATCHES.map((s) => (
                <li key={s.token} className="flex flex-col gap-2">
                  <span aria-hidden className="h-24 rounded-md border border-border-decorative" style={{ backgroundColor: `var(--color-${s.token})` }} />
                  <span className="flex flex-col">
                    <span className="text-body font-semibold">{s.name}</span>
                    <span className="text-small text-text-muted tabular-nums">
                      {s.token} · {colors[s.token]?.toUpperCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 2. Type */}
          <Section title="Type" className="col-span-5">
            <p className="text-small text-text-muted">
              <span className="font-display text-body">Fraunces</span> for headlines · <span className="text-body">Inter</span> for everything else
            </p>
            <ul className="flex flex-col gap-5">
              {typeScale.map((t) => (
                <li key={t.name} className="flex items-baseline justify-between gap-6">
                  <span className={`${t.className} ${t.name === 'Display' || t.name === 'Title' ? 'font-display' : ''}`}>{t.name} {t.size}</span>
                  <span className="text-small text-text-muted">{ROLES[t.name]}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 3. Buttons */}
          <Section title="Buttons" className="col-span-5">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-4 gap-y-3">
              <span />
              {['Default', 'Pressed', 'Disabled'].map((s) => (
                <span key={s} className={label}>
                  {s}
                </span>
              ))}
              <span className={label}>Primary</span>
              <PrimaryButton>Continue</PrimaryButton>
              <PrimaryButton forcePressed>Continue</PrimaryButton>
              <PrimaryButton disabled>Continue</PrimaryButton>
              <span className={label}>Secondary</span>
              <SecondaryButton>Cancel</SecondaryButton>
              <SecondaryButton forcePressed>Cancel</SecondaryButton>
              <SecondaryButton disabled>Cancel</SecondaryButton>
              <span className={label}>Quiet</span>
              <SecondaryButton tone="quiet">Skip</SecondaryButton>
              <SecondaryButton tone="quiet" forcePressed>
                Skip
              </SecondaryButton>
              <SecondaryButton tone="quiet" disabled>
                Skip
              </SecondaryButton>
            </div>
          </Section>

          {/* 4. Components */}
          <Section title="Components" className="col-span-7">
            <div className="grid grid-cols-[1fr_1fr_1.15fr] gap-4">
              <div className="flex flex-col gap-3">
                <AnswerTile code="F-1" description="Student visa" selected />
                <AnswerTile code="J-1" description="Exchange visitor" selected={false} />
              </div>
              <div className="flex flex-col gap-3">
                <span className={label}>Box 1 wages</span>
                {/* the field's own focus ring, shown without needing focus */}
                <div className="[&>div]:outline-2 [&>div]:outline-offset-2 [&>div]:outline-text">
                  <AmountField labelledBy="overview-wages" value="38,450.00" onChange={() => {}} />
                </div>
                <Checkbox label="This is correct" field="Box 1 wages" checked onChange={() => {}} />
              </div>
              <Card id="overview-card" title="Federal" motionProps={{}}>
                <p className="text-small font-semibold text-text-muted">{ESTIMATE_LABEL}</p>
                <Outcome status="owed" amount={119_300} what="" />
              </Card>
            </div>
          </Section>

          {/* 5. Icons and motion */}
          <Section title="Icons and motion" className="col-span-12">
            <div className="flex items-center justify-between gap-12">
              <ul className="flex items-center gap-6">
                {shown.map(({ name, Icon }) => (
                  <li key={name} className="flex flex-col items-center gap-1">
                    <Icon size={40} weight="regular" aria-hidden />
                    <span className="text-small text-text-muted">{name}</span>
                  </li>
                ))}
              </ul>
              <ul className="flex items-stretch gap-4">
                {MOTION.map((m) => (
                  <li key={m.name} className="flex flex-col gap-1 rounded-sm border border-border-decorative px-4 py-2">
                    <span className="text-body font-semibold">{m.name}</span>
                    <span className="text-small text-text-muted tabular-nums">
                      {m.ms}ms{m.bounce ? ` · bounce ${m.bounce}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </div>
      </main>
    </div>
  )
}
