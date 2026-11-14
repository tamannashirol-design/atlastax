import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { AmountField } from '../components/AmountField'
import { AnswerTile } from '../components/AnswerTile'
import { BottomSheet } from '../components/BottomSheet'
import { FlowStepper } from '../components/FlowStepper'
import { IncomeCard, Illustration } from '../components/IncomeCard'
import { extraOptions, incomeOptions } from '../data/income'
import { SearchSelect } from '../components/SearchSelect'
import { SecondaryButton } from '../components/SecondaryButton'
import { SelectField } from '../components/SelectField'
import { TileGroup } from '../components/TileGroup'
import { UploadField } from '../components/UploadField'
import { UploadFolder, type UploadState } from '../components/UploadFolder'
import { countries, usStates } from '../data/places'
import { allSteps } from '../flow/sections'
import { PrimaryButton } from '../components/PrimaryButton'
import cssText from '../index.css?raw'
import { contrastRatio } from '../lib/contrast'
import { DebugStack, useUrlFlag } from '../lib/debug'
import { spring } from '../lib/motion'
import { parseColors } from '../tokens/colors'
import { pairs, thresholds, type Pair } from '../tokens/pairs'
import { grids, icons, palette, radii, shadows, spacing, typeScale, type GridSpec } from './tokens'

const colors = parseColors(cssText)
const SpecimenIcon = icons[0].Icon

// ---------- helpers ----------

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

function deviceFor(width: number) {
  if (width < 600) return 'Phone'
  if (width < 1024) return 'iPad'
  return 'Laptop'
}

// ---------- building blocks ----------

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-11 shrink-0 items-center gap-2 rounded-full text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
    >
      {label}
      <span className={`flex h-8 w-12 rounded-full p-1 transition-colors ${on ? 'justify-end bg-text' : 'justify-start bg-border-strong'}`}>
        <motion.span layout transition={spring.quick} className="size-6 rounded-full bg-surface shadow-1" />
      </span>
    </button>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="page-grid gap-y-6 border-t border-border-decorative py-12">
      <header className="col-span-full flex max-w-column flex-col gap-1">
        <h2 className="font-display text-title">{title}</h2>
        <p className="text-body text-text-muted">{description}</p>
      </header>
      {children}
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-small text-text-muted">{children}</span>
}

function GridDiagram({ spec }: { spec: GridSpec }) {
  const content = Math.min(spec.example - spec.margin * 2, spec.maxContent ?? Infinity)
  const side = (spec.example - content) / 2
  return (
    <figure className="col-span-full flex flex-col gap-3 desktop:col-span-4">
      <div className="flex h-32 rounded-sm border border-border-decorative bg-surface py-3">
        <div
          className="grid flex-1"
          style={{
            marginInline: `${(side / spec.example) * 100}%`,
            gridTemplateColumns: `repeat(${spec.columns}, minmax(0, 1fr))`,
            columnGap: `${(spec.gutter / content) * 100}%`,
          }}
        >
          {Array.from({ length: spec.columns }, (_, i) => (
            <div key={i} className="bg-sage-100" />
          ))}
        </div>
      </div>
      <figcaption className="flex flex-col">
        <span className="text-body font-semibold">
          {spec.device} <span className="font-normal text-text-muted">· {spec.range}</span>
        </span>
        <Label>
          {spec.columns} columns · {spec.margin} margins{spec.maxContent ? ' (min)' : ''} · {spec.gutter} gutters
          {spec.maxContent ? ` · max content ${spec.maxContent}` : ''}
        </Label>
        <Label>Shown at {spec.example}px wide</Label>
      </figcaption>
    </figure>
  )
}

function PairRow({ pair }: { pair: Pair }) {
  const fg = colors[pair.fg]
  const bg = colors[pair.bg]
  const ratio = contrastRatio(fg, bg)
  const need = thresholds[pair.kind]
  const ok = ratio >= need
  return (
    <li className="col-span-full flex items-center gap-4 border-b border-border-decorative py-3 desktop:col-span-6">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-border-decorative"
        style={{ backgroundColor: bg, color: fg }}
      >
        {pair.kind === 'ui' ? (
          <span className="size-6 rounded-sm border-2" style={{ borderColor: fg }} />
        ) : (
          <span className="text-body font-semibold">Aa</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body">
          {pair.fg} <span className="text-text-muted">on</span> {pair.bg}
        </span>
        <Label>{pair.use}</Label>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-body font-semibold tabular-nums">{ratio.toFixed(2)}</span>
        <span className={`text-small tabular-nums ${ok ? 'text-success' : 'text-error'}`}>
          {ok ? 'Pass' : 'Fail'} · {need}:1
        </span>
      </span>
    </li>
  )
}

// Live stepper demo: move through the flow to see done / current / upcoming and the motion.
function StepperDemo() {
  const [index, setIndex] = useState(3) // start in "Tax details" so one section is done
  const position = allSteps[index]
  const goToSection = (section: number) => setIndex(allSteps.findIndex((p) => p.section === section))
  return (
    <>
      <div className="col-span-full flex flex-col gap-3 tablet:col-span-4 desktop:col-span-3">
        <span className="text-body font-semibold">Rail</span>
        <Label>Laptop and iPad landscape. Done sections are clickable.</Label>
        <FlowStepper presentation="rail" position={position} onNavigate={goToSection} />
      </div>
      <div className="col-span-full flex flex-col gap-3 tablet:col-span-4 desktop:col-span-6 desktop:col-start-5">
        <span className="text-body font-semibold">Compact</span>
        <Label>Phone and iPad portrait. Tap it to open the sheet.</Label>
        <div className="flex">
          <FlowStepper presentation="compact" position={position} onNavigate={goToSection} />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-3">
          <SecondaryButton onClick={() => setIndex(index - 1)} disabled={index === 0}>
            Previous step
          </SecondaryButton>
          <SecondaryButton onClick={() => setIndex(index + 1)} disabled={index === allSteps.length - 1}>
            Next step
          </SecondaryButton>
        </div>
        <Label>
          Step {index + 1} of {allSteps.length} overall
        </Label>
      </div>
    </>
  )
}

// Live form controls: the pieces the question screens are built from.
function FormControlsDemo() {
  const [years, setYears] = useState<'under5' | '5plus'>()
  const [state, setState] = useState<string>()
  const [country, setCountry] = useState<string>()
  const [sheet, setSheet] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [amount, setAmount] = useState('')
  return (
    <>
      <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
        <span id="sg-tiles" className="text-body font-semibold">
          Tile group (2 or 3 options)
        </span>
        <Label>Fills the 88pt answer area. Arrow keys move and select.</Label>
        <div className="flex h-(--answer-h)">
          <TileGroup
            labelledBy="sg-tiles"
            value={years}
            onChange={setYears}
            options={[
              { value: 'under5', code: '< 5', description: 'Less than 5 years', codeHidden: true },
              { value: '5plus', code: '5+', description: '5 years or more', codeHidden: true },
            ]}
          />
        </div>
      </div>
      <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
        <span id="sg-select" className="text-body font-semibold">
          Select field
        </span>
        <Label>Phone: the phone’s own picker. iPad and laptop: custom list (↑ ↓, Enter, Escape, type to jump).</Label>
        <SelectField labelledBy="sg-select" options={usStates} value={state} onChange={setState} placeholder="Choose a state" />
      </div>
      <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
        <span id="sg-search" className="text-body font-semibold">
          Search select
        </span>
        <Label>Type to filter; accents don’t matter. ↑ ↓, Enter, Escape.</Label>
        <SearchSelect labelledBy="sg-search" options={countries()} value={country} onChange={setCountry} placeholder="Search countries" />
      </div>
      <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
        <span className="text-body font-semibold">Upload field</span>
        <Label>Document questions. Secondary style, so Continue stays the only blue. Fits the 88pt answer area.</Label>
        <div className="flex h-(--answer-h) flex-col">
          <UploadField files={files} onChange={setFiles} />
        </div>
      </div>
      <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
        <span id="sg-amount" className="text-body font-semibold">
          Amount field
        </span>
        <Label>Dollar amounts. Number keypad on phones; tabular numerals.</Label>
        <AmountField labelledBy="sg-amount" value={amount} onChange={setAmount} />
      </div>
      <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
        <span className="text-body font-semibold">Secondary button + bottom sheet</span>
        <Label>Secondary is never blue, so each screen keeps one primary.</Label>
        <SecondaryButton onClick={() => setSheet(true)}>Open a bottom sheet</SecondaryButton>
        <AnimatePresence>
          {sheet && (
            <BottomSheet title="Sample sheet" onClose={() => setSheet(false)}>
              <p className="text-body text-text-muted">Slides up with the soft spring. Escape, the close button, or tapping outside closes it.</p>
              <div className="flex flex-col gap-2 pt-6">
                <SecondaryButton onClick={() => setSheet(false)}>Close</SecondaryButton>
              </div>
            </BottomSheet>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

// ---------- page ----------

export default function Styleguide() {
  const width = useViewportWidth()
  const [showGrid, setShowGrid] = useUrlFlag('grid')
  const [showOutlines, setShowOutlines] = useUrlFlag('outlines')

  return (
    <DebugStack grid={showGrid} outlines={showOutlines}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border-decorative bg-background/90 pt-[env(safe-area-inset-top)] page-x backdrop-blur">
        <div className="flex min-h-14 page-content flex-wrap items-center justify-between gap-x-4 py-1">
          <p className="text-body text-text-muted tabular-nums">
            <span className="font-semibold text-text">{deviceFor(width)}</span> · {width}px
          </p>
          <div className="flex items-center gap-4">
            <Toggle label="Grid" on={showGrid} onChange={setShowGrid} />
            <Toggle label="Outlines" on={showOutlines} onChange={setShowOutlines} />
          </div>
        </div>
      </div>

      <main className="page-x pb-[max(3rem,env(safe-area-inset-bottom))]">
        <div className="page-content">
          <header className="flex flex-col gap-2 pt-8 pb-12">
            <h1 className="font-display text-display">Style guide</h1>
            <p className="max-w-column text-body text-text-muted">
              AtlasTax foundations. Every value sits on a 4pt grid. Use the toggles above to check the grid and
              outline every element.
            </p>
          </header>

          <Section title="Spacing" description="4pt base unit. Use only these steps for padding, gaps and margins.">
            <div className="col-span-full flex flex-col gap-3">
              {spacing.map((v) => (
                <div key={v} className="flex items-center gap-4">
                  <span className="w-12 shrink-0 text-small font-semibold tabular-nums">{v}pt</span>
                  <span className="w-20 shrink-0 text-small text-text-muted tabular-nums">Tailwind {v / 4}</span>
                  <span className="shrink-0 bg-text" style={{ width: v, height: v }} />
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Grid"
            description="Columns stretch; margins and gutters stay fixed. Turn on Grid in the top bar to see the live grid for this screen size."
          >
            {grids.map((g) => (
              <GridDiagram key={g.device} spec={g} />
            ))}
          </Section>

          <Section
            title="Type"
            description="Two families, four sizes, nothing else. Fraunces for display (600), Inter for UI (400 and 600). Numbers are tabular."
          >
            {typeScale.map((t) => (
              <div key={t.name} className="col-span-full grid grid-cols-subgrid gap-y-4 border-b border-border-decorative pb-6">
                <div className="col-span-full flex flex-col desktop:col-span-3">
                  <span className="text-body font-semibold">{t.name}</span>
                  <Label>
                    {t.size}/{t.lineHeight}
                  </Label>
                  <Label>{t.use}</Label>
                </div>
                <div className="col-span-full flex flex-col gap-4 desktop:col-span-9">
                  <div className="flex flex-col gap-1">
                    <Label>Fraunces · 600</Label>
                    <p className={`font-display ${t.className}`}>{t.sample}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Inter · 600</Label>
                    <p className={`font-semibold ${t.className}`}>{t.sample}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Inter · 400</Label>
                    <p className={t.className}>{t.sample}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="col-span-full grid grid-cols-subgrid gap-y-4">
              <div className="col-span-full flex flex-col desktop:col-span-3">
                <span className="text-body font-semibold">Tabular numerals</span>
                <Label>Every digit is the same width, so amounts line up</Label>
              </div>
              <div className="col-span-full flex flex-col items-start desktop:col-span-9">
                {['$12,300.25', '$1,042.00', '$87.50'].map((n) => (
                  <span key={n} className="w-32 text-right text-body tabular-nums">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          <Section
            title="Color"
            description="Cobalt + sage, light mode only. Roles, not decoration: one primary-colored element per screen; everything else is text, sage, or surface."
          >
            {palette.map((group) => (
              <div key={group.group} className="col-span-full grid grid-cols-subgrid gap-y-4">
                <h3 className="col-span-full text-body font-semibold">{group.group}</h3>
                {group.roles.map((r) => (
                  <div key={r.name} className="col-span-2 flex flex-col gap-2">
                    <div className="h-16 rounded-sm border border-border-decorative" style={{ backgroundColor: colors[r.name] }} />
                    <div className="flex flex-col">
                      <span className="text-body font-semibold">{r.name}</span>
                      <Label>{colors[r.name]?.toUpperCase()}</Label>
                      <Label>{r.use}</Label>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </Section>

          <Section
            title="Contrast"
            description="Every pair the UI uses, from src/tokens/pairs.ts. Text needs 4.5:1; controls and disabled labels need 3:1. npm run contrast fails the build if any pair drops below."
          >
            <ul className="col-span-full grid grid-cols-subgrid">
              {pairs.map((p) => (
                <PairRow key={`${p.fg}-${p.bg}-${p.kind}`} pair={p} />
              ))}
            </ul>
          </Section>

          <Section
            title="Components"
            description="Real components with their states. Pressed is forced on here so you can see it without holding a finger down."
          >
            <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
              <span className="text-body font-semibold">Answer tile</span>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <Label>Unselected</Label>
                  <AnswerTile code="F-1" description="Academic" selected={false} />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <Label>Pressed</Label>
                  <AnswerTile code="J-1" description="Exchange" selected={false} forcePressed />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <Label>Selected</Label>
                  <AnswerTile code="M-1" description="Vocational" selected />
                </div>
              </div>
            </div>
            <div className="col-span-full flex flex-col gap-3">
              <span className="text-body font-semibold">Income card (multi-select)</span>
              <Label>Hover lifts with a shadow (pointer devices). Selected = navy border + check badge.</Label>
              <div className="grid auto-rows-fr grid-cols-2 gap-(--grid-gutter) tablet:grid-cols-4 desktop:grid-cols-5">
                {[
                  { name: 'Default', props: { checked: false } },
                  { name: 'Pressed', props: { checked: false, forcePressed: true } },
                  { name: 'Selected', props: { checked: true } },
                  { name: 'Placeholder (art not approved)', props: { checked: false, showArt: false } },
                  { name: 'Quiet (No earnings)', props: { checked: false, quiet: true } },
                ].map(({ name, props }) => (
                  <div key={name} className="flex min-w-0 flex-col gap-2">
                    <Label>{name}</Label>
                    <div className="flex flex-1">
                      <IncomeCard label={props.quiet ? 'No earnings' : 'Scholarship or fellowship'} form="1042-S" art={incomeOptions[3].art} {...props} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-full flex flex-col gap-3 desktop:col-span-6">
              <span className="text-body font-semibold">Primary button</span>
              <div className="flex flex-col gap-2">
                <Label>Enabled</Label>
                <PrimaryButton>Continue</PrimaryButton>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Pressed</Label>
                <PrimaryButton forcePressed>Continue</PrimaryButton>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Disabled</Label>
                <PrimaryButton disabled>Continue</PrimaryButton>
              </div>
            </div>
          </Section>

          <Section
            title="Form controls"
            description="The answer controls used on question screens. Each fits the fixed 88pt answer area so every question screen lines up."
          >
            <FormControlsDemo />
          </Section>

          <Section
            title="Stepper"
            description="One component, two presentations. Navy marks progress; Continue stays the only blue element. Use the buttons to watch the marker glide, the check draw in and the connector fill."
          >
            <StepperDemo />
          </Section>

          <Section
            title="Icons"
            description="Phosphor, Regular weight only, on a 24px grid. Every icon has a job; if it has no reason, it doesn't ship."
          >
            <figure className="col-span-full flex flex-col gap-3 tablet:col-span-3 desktop:col-span-4">
              <div
                className="grid size-48 place-items-center border border-border-decorative bg-surface"
                style={{
                  backgroundImage: `linear-gradient(to right, ${colors['sage-100']} 1px, transparent 1px), linear-gradient(to bottom, ${colors['sage-100']} 1px, transparent 1px)`,
                  backgroundSize: '8px 8px',
                }}
              >
                <SpecimenIcon size={192} weight="regular" />
              </div>
              <figcaption>
                <Label>24 × 24 grid, shown 8× · Regular weight = 1.5px stroke at 24px</Label>
              </figcaption>
            </figure>
            <ul className="col-span-full grid grid-cols-1 gap-3 tablet:col-span-5 desktop:col-span-8 desktop:grid-cols-2">
              {icons.map(({ name, Icon, reason }) => (
                <li key={name} className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-sage-100">
                    <Icon size={24} weight="regular" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body font-semibold">{name}</span>
                    <Label>{reason}</Label>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Illustrations"
            description="The designer's files (src/assets/illustrations/), trimmed and normalized to equal padding (no redrawing or recoloring), shown in an 80px box on phone and 96px from 600px, decorative (empty alt), lazy loaded, Income cards only. Each is shown on a white card, on the selected card (white + navy border), and on sage (the pressed fill), so halos or hard edges would show."
          >
            {[...incomeOptions, ...extraOptions]
              .filter((o) => o.art)
              .map((o) => (
                <figure key={o.id} className="col-span-full flex flex-col gap-2 tablet:col-span-4 desktop:col-span-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      'bg-surface border-border-decorative',
                      'bg-surface border-text shadow-[inset_0_0_0_1px_var(--color-text)]',
                      'bg-sage-100 border-sage-100',
                    ].map((look) => (
                      <div key={look} className={`flex h-28 items-center justify-center rounded-md border ${look}`}>
                        <Illustration art={o.art!} />
                      </div>
                    ))}
                  </div>
                  <figcaption className="flex flex-col">
                    <span className="text-body font-semibold">{o.label}</span>
                    <Label>{o.file}</Label>
                  </figcaption>
                </figure>
              ))}
          </Section>

          <Section
            title="Upload folder (for approval)"
            description="Static drawing for the upload animation; nothing moves yet. Inline SVG built only from tokens: body primary-tint, outline border-strong (2px), file surface with navy details, progress navy, success and error badges in their tokens. All text is real HTML."
          >
            {(
              [
                { state: 'idle', progress: 0, text: 'Drop your file here or choose one', tone: 'text-text text-body' },
                { state: 'uploading', progress: 0.6, text: 'Uploading… 60%', tone: 'text-text-muted text-small tabular-nums' },
                { state: 'success', progress: 1, text: 'W-2 added', tone: 'text-success text-small' },
                { state: 'error', progress: 0, text: 'That file didn’t upload. Try again.', tone: 'text-error text-small' },
              ] as { state: UploadState; progress: number; text: string; tone: string }[]
            ).map((v) => (
              <figure key={v.state} className="col-span-2 flex flex-col items-center gap-3 tablet:col-span-2 desktop:col-span-3">
                <div className="flex h-32 w-full items-center justify-center rounded-md border border-border-decorative bg-background">
                  <UploadFolder state={v.state} progress={v.progress} />
                </div>
                <figcaption className="flex flex-col items-center gap-1 text-center">
                  <span className={v.tone}>{v.text}</span>
                  <Label>{v.state}</Label>
                </figcaption>
              </figure>
            ))}
          </Section>

          <Section title="Radii" description="Three corner sizes. Bigger surfaces get rounder corners.">
            {radii.map((r) => (
              <div key={r.name} className="col-span-full flex flex-col gap-3 tablet:col-span-2 desktop:col-span-4">
                <div className={`h-24 border border-border-strong bg-surface ${r.className}`} />
                <div className="flex flex-col">
                  <span className="text-body font-semibold">
                    {r.value} <span className="font-normal text-text-muted">· {r.name}</span>
                  </span>
                  <Label>{r.use}</Label>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Shadows" description="Three levels, tinted navy. Higher means closer to the user.">
            {shadows.map((s) => (
              <div key={s.name} className="col-span-full flex flex-col gap-3 tablet:col-span-2 desktop:col-span-4">
                <div className="flex h-32 items-center rounded-md bg-sage-100 p-6">
                  <div className={`h-16 flex-1 rounded-md bg-surface ${s.className}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-body font-semibold">{s.name}</span>
                  <Label>{s.use}</Label>
                </div>
              </div>
            ))}
          </Section>
        </div>
      </main>
    </DebugStack>
  )
}
