import { CheckIcon, CircleDashedIcon, ClockIcon, MinusCircleIcon, UploadSimpleIcon, type Icon } from '@phosphor-icons/react'
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
import { documentsLine, incomeItemsLine, requiredItems, selfReportKey, summarizeItems, type DocumentItem, type IncomeItem } from '../flow/requiredDocuments'
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
// Everything listed comes from requiredItems() (rules: documents.config.ts):
//   Summary   "2 of 3 documents added" + thin navy bar (documents only);
//             "1 income item needs details" on its own line
//   Documents each with status (text + icon), Upload (sheet with the real
//             upload), and "I'll add it later" / "I don't have this"
//   Income without a form (self-reported): neutral intro, "Details needed",
//             "I'll add it later". TODO confirm with CPA: what to collect.
// Each item has its own address: /documents#item-<id> scrolls to and focuses it.
//
// Layout: the question column (6 of 8/12 columns); from the flow, the rail
// sits in columns 1–3 at 1024+, like the question screens.

const column = 'col-span-full tablet:col-span-6 tablet:col-start-2 desktop:col-start-4'
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'
const quietLink = `flex min-h-11 min-w-12 items-center justify-center rounded-sm text-body font-semibold underline underline-offset-4 ${focusRing}`

// Identity first (needed by everyone with a supported status), then income documents
const GROUPS = [
  { id: 'identity', title: 'Identity' },
  { id: 'income', title: 'Income documents' },
] as const

const docStatus: Record<DocumentItem['status'], { text: (d: DocumentItem) => string; Icon: Icon; tone: string }> = {
  added: {
    text: (d) => (d.files.length === 1 ? 'Added · 1 file' : `Added · ${d.files.length} files`),
    Icon: CheckIcon,
    tone: 'text-success',
  },
  later: {
    text: () => 'You’ll add it later',
    Icon: ClockIcon,
    tone: 'text-text',
  },
  none: {
    text: () => 'You don’t have this',
    Icon: MinusCircleIcon,
    tone: 'text-text',
  },
  missing: {
    text: () => 'Not added yet',
    Icon: CircleDashedIcon,
    tone: 'text-text',
  },
}
const incomeStatus: Record<IncomeItem['status'], { text: string; Icon: Icon }> = {
  'details-needed': { text: 'Details needed', Icon: CircleDashedIcon },
  later: { text: 'You’ll add the details later', Icon: ClockIcon },
  provided: { text: 'Details added', Icon: CheckIcon },
}

export default function DocumentsPage() {
  const answers = useAnswers()
  const year = useFilingYear()
  const reduce = useReducedMotionConfig() ?? false
  // Follows history state, so opening the tab while on this page drops the flow frame
  const fromFlow = useHistoryState().fromFlow === true
  const [uploading, setUploading] = useState<DocumentItem | null>(null)
  const [announce, setAnnounce] = useState('')
  const [why, setWhy] = useState(false)
  const items = requiredItems(answers)
  const summary = summarizeItems(items)
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

          <div className={`flex flex-col ${column} ${fromFlow ? 'desktop:row-start-1' : ''}`}>
            <h1 id="documents-title" tabIndex={-1} className="font-display text-display outline-none">
              Documents
            </h1>
            <p className="mt-2 text-small text-text-muted">For your {year} tax return</p>

            {/* Summary: documents only on the first line; income items on their own line */}
            <motion.section aria-label="Summary" className="mt-8 flex flex-col gap-3" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0)}>
              <p className="flex items-center gap-2 text-body font-semibold">
                {summary.documents.total > 0 && summary.documents.missing === 0 ? (
                  <CheckIcon size={24} weight="regular" aria-hidden className="text-success" />
                ) : (
                  <CircleDashedIcon size={24} weight="regular" aria-hidden />
                )}
                <span className="tabular-nums">{documentsLine(summary)}</span>
              </p>
              {summary.documents.total > 0 && <ProgressBar value={summary.documents.added / summary.documents.total} reduce={reduce} />}
              {incomeItemsLine(summary) && (
                <p className="flex items-center gap-2 text-body">
                  <CircleDashedIcon size={24} weight="regular" aria-hidden />
                  <span className="tabular-nums">{incomeItemsLine(summary)}</span>
                </p>
              )}
              {items.length === 0 && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-expanded={why}
                    aria-controls="documents-why"
                    onClick={() => setWhy((w) => !w)}
                    className={`self-start ${quietLink}`}
                  >
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
                  <h2 id={`documents-${group.id}`} className="font-display text-title">
                    {group.title}
                  </h2>
                  <ul className="flex flex-col gap-4">
                    {groupDocs.map((d, i) => {
                      const s = docStatus[d.status]
                      return (
                        <motion.li
                          key={d.id}
                          id={`item-${d.id}`}
                          tabIndex={-1}
                          aria-labelledby={`item-${d.id}-title`}
                          initial={enter}
                          animate={{ opacity: 1, y: 0 }}
                          transition={t(i + 1)}
                          className={`flex flex-col gap-3 rounded-md border border-border-strong bg-surface p-4 ${focusRing}`}
                        >
                          <div className="flex flex-col">
                            <span id={`item-${d.id}-title`} className="text-body font-semibold">
                              {d.form}
                            </span>
                            <span className="text-small text-text-muted">{d.source}</span>
                          </div>
                          <p className={`flex items-center gap-2 text-small font-semibold ${s.tone}`}>
                            <s.Icon size={24} weight="regular" aria-hidden />
                            <span className="tabular-nums">{s.text(d)}</span>
                          </p>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                            <button
                              type="button"
                              onClick={() => setUploading(d)}
                              className={`flex h-11 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-body font-semibold active:bg-sage-100 ${focusRing}`}
                            >
                              <UploadSimpleIcon size={24} weight="regular" aria-hidden />
                              {d.status === 'added' ? 'Manage files' : 'Upload'}
                              <span className="sr-only"> {d.form}</span>
                            </button>
                            {d.status === 'missing' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => change(d.id, () => setDetail(d.uploadScreen, 'later'), `${d.form}: you’ll add it later`)}
                                  className={quietLink}
                                >
                                  I’ll add it later
                                </button>
                                <button
                                  type="button"
                                  onClick={() => change(d.id, () => setDetail(d.uploadScreen, 'none'), `${d.form}: you don’t have this`)}
                                  className={quietLink}
                                >
                                  I don’t have this
                                </button>
                              </>
                            )}
                            {(d.status === 'later' || d.status === 'none') && (
                              <button
                                type="button"
                                onClick={() => change(d.id, () => clearDetail(d.uploadScreen), `${d.form}: not added yet`)}
                                className={quietLink}
                              >
                                Undo
                                <span className="sr-only"> for {d.form}</span>
                              </button>
                            )}
                          </div>
                        </motion.li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            {income.length > 0 && (
              <section aria-labelledby="documents-income" className="mt-10 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 id="documents-income" className="font-display text-title">
                    Income without a form
                  </h2>
                  <p className="text-body text-text-muted">{SELF_REPORTED_INTRO}</p>
                </div>
                <ul className="flex flex-col gap-4">
                  {income.map((item, i) => {
                    const s = incomeStatus[item.status]
                    return (
                      <motion.li
                        key={item.id}
                        id={`item-${item.id}`}
                        tabIndex={-1}
                        aria-labelledby={`item-${item.id}-title`}
                        initial={enter}
                        animate={{ opacity: 1, y: 0 }}
                        transition={t(docs.length + i + 1)}
                        className={`flex flex-col gap-3 rounded-md border border-border-strong bg-surface p-4 ${focusRing}`}
                      >
                        <span id={`item-${item.id}-title`} className="text-body font-semibold">
                          {item.incomeLabel}
                        </span>
                        <p className="flex items-center gap-2 text-small font-semibold">
                          <s.Icon size={24} weight="regular" aria-hidden />
                          {s.text}
                        </p>
                        {/* TODO confirm with CPA: what details to ask for here (SELF_REPORTED_DETAILS). Nothing is collected yet. */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                          {item.status === 'details-needed' && (
                            <button
                              type="button"
                              onClick={() =>
                                change(item.id, () => setDetail(selfReportKey(item.id), 'later'), `${item.incomeLabel}: you’ll add the details later`)
                              }
                              className={quietLink}
                            >
                              I’ll add it later
                            </button>
                          )}
                          {item.status === 'later' && (
                            <button
                              type="button"
                              onClick={() => change(item.id, () => clearDetail(selfReportKey(item.id)), `${item.incomeLabel}: details needed`)}
                              className={quietLink}
                            >
                              Undo
                              <span className="sr-only"> for {item.incomeLabel}</span>
                            </button>
                          )}
                        </div>
                      </motion.li>
                    )
                  })}
                </ul>
              </section>
            )}

            {fromFlow && (
              <div className="mt-10 flex flex-col gap-2">
                <PrimaryButton disabled={!summary.done} onClick={() => navigate(REVIEW_PATH)}>
                  Continue
                </PrimaryButton>
                {!summary.done && (
                  <p className="text-small text-text-muted">For each item, add it or choose “I’ll add it later” (or “I don’t have this”) to continue.</p>
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
            title={`Upload: ${uploading.form}`}
            onClose={() => {
              const id = uploading.id
              afterSheet.current = () => document.getElementById(`item-${id}`)?.focus({ preventScroll: true })
              setUploading(null)
            }}
          >
            <p className="text-body text-text-muted">{uploading.source}</p>
            <div className="pt-6">
              <SheetUpload item={uploading} />
            </div>
            <div className="flex flex-col pt-8">
              <SecondaryButton
                onClick={() => {
                  const id = uploading.id
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
function SheetUpload({ item }: { item: DocumentItem }) {
  const answers = useAnswers()
  const v = answers.details?.[item.uploadScreen]
  const files = Array.isArray(v) ? v : []
  return (
    <UploadAnswer
      docLabel={item.form}
      uploaded={files}
      allowAnother
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
