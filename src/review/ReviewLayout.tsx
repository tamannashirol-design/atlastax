import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { FlowStepper } from '../components/FlowStepper'
import { at } from '../flow/sections'
import { Link } from '../lib/router'

// Review's layout. Same shell, stepper and grid as the question screens, but the
// content is long, so it starts at the top (no vertical centering) and scrolls.
//
//   Phone (4 cols)        header · [View document] · details · footer, stacked
//   iPad (8 cols)         header full width; file cols 1–4 | details cols 5–8
//   Laptop (12 cols)      rail cols 1–3 | header cols 4–12; file cols 4–7 | details cols 8–12
// Below 1024px the compact stepper sits under the top bar, like every flow screen.
// The file column is sticky on iPad and laptop, so it stays next to the details.

type Props = {
  year: number
  backHref: string
  backState?: Record<string, unknown>
  header: ReactNode
  /** iPad and laptop: the file preview column. Omit for one-column screens (the summary). */
  file?: ReactNode
  children: ReactNode
  onNavigate?: (section: number) => void
}

export function ReviewLayout({ year, backHref, backState, header, file, children, onNavigate }: Props) {
  const position = at('review')
  const wide = file ? 'tablet:col-span-4 tablet:col-start-5 desktop:col-span-5 desktop:col-start-8' : 'tablet:col-span-6 tablet:col-start-2 desktop:col-span-6 desktop:col-start-4'
  return (
    <AppShell
      title={`${year} tax return`}
      backHref={backHref}
      backState={backState}
      activeTab="home"
      action={
        <Link href="/" className="flex min-h-11 items-center rounded-sm text-small font-semibold whitespace-nowrap underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
          Save and exit
        </Link>
      }
    >
      <div className="flex flex-1 flex-col page-x">
        <div className="page-content page-grid desktop:hidden">
          <div className={`col-span-full flex h-(--stepper-h) items-center ${file ? '' : 'tablet:col-span-6 tablet:col-start-2'}`}>
            <FlowStepper presentation="compact" position={position} onNavigate={onNavigate} />
          </div>
        </div>
        <div className="page-content page-grid grid-rows-[auto_1fr] pt-6 pb-10 desktop:pt-10">
          <div className="hidden self-start desktop:col-span-3 desktop:col-start-1 desktop:row-span-2 desktop:row-start-1 desktop:block">
            <FlowStepper presentation="rail" position={position} onNavigate={onNavigate} />
          </div>
          <div className={`col-span-full row-start-1 flex flex-col gap-2 ${file ? 'desktop:col-span-9 desktop:col-start-4' : 'tablet:col-span-6 tablet:col-start-2 desktop:col-span-6 desktop:col-start-4'}`}>{header}</div>
          {file && <div className="hidden self-start pt-10 tablet:sticky tablet:top-6 tablet:col-span-4 tablet:col-start-1 tablet:row-start-2 tablet:block desktop:col-start-4">{file}</div>}
          <div className={`col-span-full row-start-2 flex flex-col pt-10 ${wide}`}>{children}</div>
        </div>
      </div>
    </AppShell>
  )
}

/** "2 of 4" above the headline (screen readers: "Document 2 of 4") */
export function Indicator({ at: i, of: n }: { at: number; of: number }) {
  return (
    <p className="text-small text-text-muted tabular-nums">
      <span className="sr-only">Document </span>
      {i} of {n}
    </p>
  )
}
