import { CheckIcon, CircleDashedIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { BottomSheet } from '../components/BottomSheet'
import { FlowStepper } from '../components/FlowStepper'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { UploadAnswer } from '../components/UploadAnswer'
import { SELF_REPORTED_INTRO } from '../documents.config'
import { clearDetail, setDetail, useAnswers, useFilingYear } from '../flow/answers'
import { documentsLine, incomeItemsLine, selfReportKey, type DocumentItem, type IncomeItem } from '../flow/requiredDocuments'
import { DocumentCard } from './DocumentCard'
import { documentArt, incomeArt } from './artwork'
import { returnStatus } from '../home/returnStatus'
import { REVIEW_PATH, pathForSection, resumeScreen } from '../flow/screens'
import { at, sectionIndex } from '../flow/sections'
import { spring } from '../lib/motion'
import { Link, navigate, useHistoryState } from '../lib/router'

// THE Documents page: the Documents tab, and the flow's Documents step.
// Same page either way; only the frame differs:
//   from the tab  "Documents" title, tab bar, no stepper, no Continue
//   from the flow back arrow, the stepper (compact / rail at 1024+) and a
//                 Continue button (enabled once nothing is outstanding)
// "From the flow" is remembered in history state ({ fromFlow: true }), so a
// reload keeps it and opening the tab never shows Continue.
//
// Everything listed comes from requiredItems() via returnStatus() (rules:
// documents.config.ts). Presentation (friendly, not a form):
//   Top     "<added> of <total> added", a thin navy bar, and a human line:
//           "<n> to go. Add what you have, and you can come back for the rest."
//           The count ticks up (soft spring) when a document is added.
//   Groups  Identity · Income documents · Income without a form, each with a
//           quiet heading and a short friendly line (TODO confirm wording)
//   Cards   DocumentCard: art, name, hint and one soft "Add" ("Replace" plus an
//           "Added" pill once uploaded). No pill while not added, and no "Not
//           now": every required document is needed to prepare the return.
//           Drop a file on a card (iPad, laptop) to add it.
// Each item has its own address: /documents#item-<id> scrolls to and focuses it.
//
// Layout: phone one column; iPad and laptop a two-column card grid in the
// content area (6 columns on iPad; 8 on laptop, right of the rail when
// arriving from the flow). Continue is the page's only cobalt element.

// From the flow the rail takes columns 1–3, so the content starts at 4; from the tab it's centred
const column = (fromFlow: boolean) => `col-span-full tablet:col-span-6 tablet:col-start-2 desktop:col-span-8 ${fromFlow ? 'desktop:col-start-4' : 'desktop:col-start-3'}`
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'
const quietLink = `flex min-h-11 min-w-12 items-center justify-center rounded-sm text-body font-semibold underline underline-offset-4 ${focusRing}`

// TODO confirm wording
const GROUPS = [
  { id: 'identity', title: 'Identity', line: 'These show who you are. A clear photo or a PDF works.' },
  { id: 'income', title: 'Income documents', line: 'Forms from your employer, school or bank.' },
  // TODO confirm wording
  { id: 'other', title: 'Other documents', line: 'Your return from an earlier year, if you have it.' },
] as const

export default function DocumentsPage() {
  const answers = useAnswers()
  const year = useFilingYear()
  const reduce = useReducedMotionConfig() ?? false
  // Follows history state, so opening the tab while on this page drops the flow frame
  const fromFlow = useHistoryState().fromFlow === true
  // The open upload sheet: which document, and a file dropped on its card (if any)
  const [uploading, setUploading] = useState<{ item: DocumentItem; file?: File } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [why, setWhy] = useState(false)
  // Same source as Home and its stepper
  const status = returnStatus(answers, year)
  const items = status.items
  const summary = status.documents
  const docs = items.filter((i): i is DocumentItem => i.kind === 'document')
  const income = items.filter((i): i is IncomeItem => i.kind === 'income')
  const back = resumeScreen(answers).path
  const afterSheet = useRef<() => void>(() => {})

  useEffect(() => {
    document.title = 'Documents · AtlasTax'
    // Linked to one item: bring it into view and focus it
    const id = window.location.hash.slice(1)
    const el = id ? document.getElementById(id) : null
    if (el) {
      el.scrollIntoView({ block: 'center' })
      el.focus({ preventScroll: true })
    } else if (fromFlow) document.getElementById('documents-title')?.focus({ preventScroll: true })
  }, [fromFlow])

  /** Change an item's state, say so, and keep focus on its row (its buttons change). */
  const change = (id: string, apply: () => void, message: string) => {
    // Focus the row first: the pressed button disappears with the change, and focus must never drop to the body
    document.getElementById(`item-${id}`)?.focus({ preventScroll: true })
    apply()
    setAnnounce(message)
  }

  // Still to do: every document not added, skipped ones included (documents only, like the count; income items have their own line)
  const toGo = summary.documents.missing
  // Card order for the entrance stagger: Identity, Income documents, then income without a form
  const order = [...GROUPS.flatMap((g) => docs.filter((d) => d.group === g.id)), ...income].map((i) => i.id)

  const t = (i: number) => (reduce ? spring.fade : { ...spring.soft, delay: i * 0.04 })
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 8 }

  return (
    <AppShell title={fromFlow ? `${year} tax return` : 'Documents'} backHref={fromFlow ? back : undefined} activeTab="documents">
      <div className="flex flex-1 flex-col page-x">
        {fromFlow && (
          <div className="page-content page-grid desktop:hidden">
            <div className="col-span-full flex h-(--stepper-h) items-center tablet:col-span-6 tablet:col-start-2">
              <FlowStepper
                presentation="compact"
                position={at('documents')}
                completed={{ [sectionIndex('documents')]: summary.done }}
                onNavigate={(section) => {
                  const t = pathForSection(section, answers, year)
                  navigate(t.path, t.state)
                }}
              />
            </div>
          </div>
        )}

        <div className="page-content page-grid pt-8 pb-12">
          {fromFlow && (
            <div className="hidden self-start desktop:col-span-3 desktop:col-start-1 desktop:block">
              <FlowStepper
                presentation="rail"
                position={at('documents')}
                completed={{ [sectionIndex('documents')]: summary.done }}
                onNavigate={(section) => {
                  const t = pathForSection(section, answers, year)
                  navigate(t.path, t.state)
                }}
              />
            </div>
          )}

          <div className={`flex flex-col ${column(fromFlow)} ${fromFlow ? 'desktop:row-start-1' : ''}`}>
            <h1 id="documents-title" tabIndex={-1} className="font-display text-display outline-none">
              Documents
            </h1>
            <p className="mt-2 text-small text-text-muted">For your {year} tax return</p>

            {/* Progress: documents only; income items on their own line */}
            <motion.section aria-label="Your progress" className="mt-8 flex flex-col gap-3" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0)}>
              {summary.documents.total > 0 && (
                <>
                  <p className="flex items-center gap-2 font-display text-title">
                    {summary.documents.missing === 0 ? <CheckIcon size={24} weight="regular" aria-hidden className="text-success" /> : <CircleDashedIcon size={24} weight="regular" aria-hidden />}
                    <span className="tabular-nums">
                      <Count value={summary.documents.added} reduce={reduce} /> of {summary.documents.total} added
                    </span>
                  </p>
                  <ProgressBar value={summary.documents.added / summary.documents.total} reduce={reduce} />
                </>
              )}
              {/* TODO confirm wording. No promises about speed, accuracy or automatic reading. */}
              <p className="text-body text-text-muted tabular-nums">
                {items.length === 0
                  ? documentsLine(summary)
                  : toGo > 0
                    ? `${toGo} to go. Add what you have, and you can come back for the rest.`
                    : 'All done for now. You can come back any time to add more.'}
              </p>
              {incomeItemsLine(summary) && (
                <p className="flex items-center gap-2 text-body">
                  <CircleDashedIcon size={24} weight="regular" aria-hidden />
                  <span className="tabular-nums">{incomeItemsLine(summary)}</span>
                </p>
              )}
              {items.length === 0 && (
                <div className="flex flex-col">
                  <button type="button" aria-expanded={why} aria-controls="documents-why" onClick={() => setWhy((w) => !w)} className={`self-start ${quietLink}`}>
                    Why no documents yet?
                  </button>
                  {why && (
                    <div id="documents-why" className="flex flex-col">
                      <p className="text-body text-text-muted">
                        The documents you need depend on the income you tell us about. Once you add income that comes with a tax form, it shows up here.
                      </p>
                      <Link href="/income" className={`self-start ${quietLink}`}>
                        Review your income
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </motion.section>

            {GROUPS.map((group) => {
              const groupDocs = docs.filter((d) => d.group === group.id)
              if (!groupDocs.length) return null
              return (
                <section key={group.id} aria-labelledby={`documents-${group.id}`} className="mt-10 flex flex-col gap-4">
                  <div className="flex flex-col">
                    <h2 id={`documents-${group.id}`} className="text-body font-semibold">
                      {group.title}
                    </h2>
                    <p className="text-small text-text-muted">{group.line}</p>
                  </div>
                  <ul className="grid gap-(--grid-gutter) tablet:grid-cols-2">
                    {groupDocs.map((d) => (
                      <DocumentCard
                        key={d.id}
                        id={d.id}
                        index={order.indexOf(d.id)}
                        name={d.form}
                        optional={d.optional}
                        // The hint stays the same once added (a long file name would grow the card); files are listed under Replace
                        hint={d.source}
                        art={documentArt(d.id)}
                        pill={d.status === 'added' ? 'added' : undefined}
                        primary={{ label: d.status === 'added' ? 'Replace' : 'Add', onClick: () => setUploading({ item: d }) }}
                        onDropFile={(file) => setUploading({ item: d, file })}
                      />
                    ))}
                  </ul>
                </section>
              )
            })}

            {income.length > 0 && (
              <section aria-labelledby="documents-income" className="mt-10 flex flex-col gap-4">
                <div className="flex flex-col">
                  <h2 id="documents-income" className="text-body font-semibold">
                    Income without a form
                  </h2>
                  <p className="text-small text-text-muted">{SELF_REPORTED_INTRO}</p>
                </div>
                {/* TODO confirm with CPA: what details to ask for here (SELF_REPORTED_DETAILS). Nothing is collected yet. */}
                <ul className="grid gap-(--grid-gutter) tablet:grid-cols-2">
                  {income.map((item) => (
                    <DocumentCard
                      key={item.id}
                      id={item.id}
                      index={order.indexOf(item.id)}
                      name={item.incomeLabel}
                      hint="No form for this one"
                      art={incomeArt(item.income)}
                      pill={item.status === 'provided' ? 'added' : item.status === 'details-needed' ? 'details' : undefined}
                      secondary={
                        item.status === 'details-needed'
                          ? { kind: 'button', label: 'Remind me later', onClick: () => change(item.id, () => setDetail(selfReportKey(item.id), 'later'), `${item.incomeLabel}: you’ll add the details later`) }
                          : item.status === 'later'
                            ? { kind: 'button', label: 'Undo', onClick: () => change(item.id, () => clearDetail(selfReportKey(item.id)), `${item.incomeLabel}: details needed`) }
                            : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            )}

            {fromFlow && (
              <div className="mt-10 grid gap-2 tablet:grid-cols-2 tablet:gap-x-(--grid-gutter)">
                <PrimaryButton disabled={!summary.done} onClick={() => navigate(REVIEW_PATH)}>
                  Continue
                </PrimaryButton>
                {!summary.done && (
                  <p className="text-small text-text-muted tablet:col-span-2">Add each document to continue.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <AnimatePresence onExitComplete={() => afterSheet.current()}>
        {uploading && (
          <BottomSheet
            title={`Add: ${uploading.item.form}`}
            onClose={() => {
              const id = uploading.item.id
              afterSheet.current = () => document.getElementById(`item-${id}`)?.focus({ preventScroll: true })
              setUploading(null)
            }}
          >
            <p className="text-body text-text-muted">{uploading.item.source}</p>
            <div className="pt-6">
              <SheetUpload item={uploading.item} initialFile={uploading.file} />
            </div>
            <div className="flex flex-col pt-8">
              <SecondaryButton
                onClick={() => {
                  const id = uploading.item.id
                  afterSheet.current = () => document.getElementById(`item-${id}`)?.focus({ preventScroll: true })
                  setUploading(null)
                }}
              >
                Done
              </SecondaryButton>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

/** The real upload, saving to the same answer the flow's upload question uses. */
function SheetUpload({ item, initialFile }: { item: DocumentItem; initialFile?: File }) {
  const answers = useAnswers()
  const v = answers.details?.[item.uploadScreen]
  const files = Array.isArray(v) ? v : []
  return (
    <UploadAnswer
      docLabel={item.form}
      uploaded={files}
      allowAnother
      initialFile={initialFile}
      onUploaded={(name) => setDetail(item.uploadScreen, [...files, name])}
      onRemove={(i) =>
        setDetail(
          item.uploadScreen,
          files.filter((_, j) => j !== i),
        )
      }
    />
  )
}

/** A number that ticks up: the new value rises in with the soft spring (reduced motion: fades). */
function Count({ value, reduce }: { value: number; reduce: boolean }) {
  return (
    <span data-stack className="inline-grid overflow-hidden align-bottom">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="[grid-area:1/1]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: '60%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: '-60%' }}
          transition={reduce ? spring.fade : spring.soft}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** Thin navy bar (documents added / required). Sage track; the fill grows with a transform. Decorative: the line above says it. */
function ProgressBar({ value, reduce }: { value: number; reduce: boolean }) {
  return (
    <span aria-hidden data-stack className="grid h-1 w-full">
      <span className="rounded-full bg-border-decorative [grid-area:1/1]" />
      <motion.span
        className="rounded-full bg-text [grid-area:1/1]"
        style={{ originX: 0 }}
        initial={{ scaleX: reduce ? value : 0 }}
        animate={{ scaleX: value }}
        transition={reduce ? spring.fade : spring.soft}
      />
    </span>
  )
}
