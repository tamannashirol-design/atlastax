import { CheckIcon, CircleDashedIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { AnimatePresence, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { DocumentUploadSheet } from '../documents/DocumentUploadSheet'
import { retryReading, useExtraction } from '../extraction/client'
import { ITEM_FORMS } from '../extraction.config'
import { setAnswers, useAnswers, useFilingYear } from '../flow/answers'
import { requiredItems, type DocumentItem } from '../flow/requiredDocuments'
import { AFTER_FLOW, RESULT_PATH, REVIEW_PATH, pathForSection } from '../flow/screens'
import { navigate, useHistoryState } from '../lib/router'
import { ReadingPill } from '../reading/ReadingPill'
import { refreshReview, saveReview, serverBackend, useReviewBackend, useReviewState } from './client'
import { FieldRow } from './FieldRow'
import { FilePreview } from './FilePreview'
import { FIXTURE_ITEMS, FIXTURE_START, isReviewFixture, type ReviewFixture } from './fixtureNames'
import type { Backend } from './client'
import { canConfirm, failureLine, leftLine, summaryStatus, SUMMARY_TEXT, type FieldPatch, type ReviewDoc, type SummaryStatus } from './logic'
import { Indicator, ReviewLayout } from './ReviewLayout'

// Review (/review): "Check your details". Plan: EXTRACTION-PLAN.md §5; rules in logic.ts.
// One document per screen, in Review order (passport, I-94, then income documents),
// "2 of 4", then a summary. Which screen shows rides in history state { doc }, so
// the browser's back button works; without it, Review resumes where the person
// was (answers.reviewAt) or at the first document not done yet.
//   Fields ready        the details, Confirm and continue (locked until done, says what's left)
//   Couldn't read       Enter it myself (empty fields) · Try again · Replace file
//   Wrong document      Replace file · Enter it myself
//   Being read          the Reading pill for this document (after Replace, or not read yet)
// Every screen: a quiet "Skip this document for now". Saved as the person goes.
// The Reading page's "Enter it myself" arrives with { enter: [ids] }.
// Dev: ?review=needs|ticked|failed|wrongtype|replace|summary (fixtures.ts; nothing sent).

const HEADING_ID = 'q-review'
const SUMMARY = 'summary'
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'
/** "passport", "most recent I-94", but "W-2" as it is */
const spoken = (form: string) => (/^[A-Z][a-z]/.test(form) ? form[0].toLowerCase() + form.slice(1) : form)

type Item = { id: string; form: string; files: string[]; doc?: DocumentItem }

export default function ReviewPage() {
  const answers = useAnswers()
  const year = useFilingYear()
  const history = useHistoryState()
  const extraction = useExtraction()
  const reduce = useReducedMotionConfig() ?? false

  // Server, or a dev fixture (read once)
  const [fixture] = useState(() => {
    const q = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('review') : null
    return isReviewFixture(q) ? q : null
  })
  useReviewBackend(fixture ? `fixture:${fixture}` : `server:${year}`, () => (fixture ? devFixtureBackend(fixture) : serverBackend(year)))
  const review = useReviewState()
  useEffect(() => void refreshReview(), [fixture, year])

  // The documents to check, in order (required documents that were added and are read)
  const items: Item[] = fixture
    ? FIXTURE_ITEMS
    : requiredItems(answers)
        .filter((i): i is DocumentItem => i.kind === 'document' && i.status === 'added' && !i.optional && i.id in ITEM_FORMS)
        .map((d) => ({ id: d.id, form: d.form, files: d.files, doc: d }))

  // "Enter it myself" from the Reading page: those documents start with empty fields
  const enter = Array.isArray(history.enter) ? (history.enter as string[]) : null
  useEffect(() => {
    if (!enter?.length || !review.loaded) return
    void (async () => {
      for (const id of enter) await saveReview(id, { manual: true })
      navigate(REVIEW_PATH, { doc: enter[0] }, { replace: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.loaded, enter?.join()])

  // Which screen: history state, else where they were, else the first not done
  const firstOpen = items.find((i) => !['confirmed', 'skipped'].includes(review.docs[i.id]?.status ?? 'open'))?.id ?? SUMMARY
  const asked = typeof history.doc === 'string' ? history.doc : fixture ? FIXTURE_START[fixture] : answers.reviewAt
  const current = asked === SUMMARY || items.some((i) => i.id === asked) ? asked! : firstOpen
  useEffect(() => {
    if (!fixture && review.loaded && current !== answers.reviewAt) setAnswers({ reviewAt: current })
  }, [current, fixture, review.loaded, answers.reviewAt])

  // Live region (polite) and focus on the headline on every screen change
  const [announce, setAnnounce] = useState('')
  const say = (m: string) => {
    setAnnounce('')
    requestAnimationFrame(() => setAnnounce(m))
  }
  useEffect(() => {
    document.title = 'Check your details · AtlasTax'
    if (review.loaded) document.getElementById(HEADING_ID)?.focus({ preventScroll: true })
  }, [current, review.loaded])

  // Nothing to check: back to Documents
  useEffect(() => {
    if (!fixture && review.loaded && !review.failed && items.length === 0) navigate(AFTER_FLOW, { fromFlow: true }, { replace: true })
  }, [fixture, review.loaded, review.failed, items.length])

  // A document being read (after Replace): fetch its fields when the reading changes
  const readSig = items.map((i) => `${i.id}:${extraction.documents[i.id]?.status ?? ''}`).join('|')
  useEffect(() => {
    if (!fixture && review.loaded) void refreshReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readSig])

  const index = items.findIndex((i) => i.id === current)
  const go = (id: string) => navigate(REVIEW_PATH, { doc: id })
  const next = () => go(items[index + 1]?.id ?? SUMMARY)
  const backHref = REVIEW_PATH
  const backState = current === SUMMARY ? { doc: items[items.length - 1]?.id ?? SUMMARY } : index > 0 ? { doc: items[index - 1].id } : undefined
  const onNavigate = (section: number) => {
    const t = pathForSection(section, answers, year)
    navigate(t.path, t.state)
  }

  if (!review.loaded) return null
  if (review.failed)
    return (
      <ReviewLayout year={year} backHref={AFTER_FLOW} backState={{ fromFlow: true }} onNavigate={onNavigate} header={<Heading>Check your details</Heading>}>
        <div className="flex flex-col gap-4">
          <p className="text-body">We couldn’t load your details.</p>
          <SecondaryButton onClick={() => void refreshReview()}>Try again</SecondaryButton>
        </div>
      </ReviewLayout>
    )

  const live = (
    <p className="sr-only" aria-live="polite">
      {announce}
    </p>
  )

  if (current === SUMMARY)
    return (
      <>
        <Summary year={year} items={items} docs={review.docs} backState={backState} onNavigate={onNavigate} onEdit={go} />
        {live}
      </>
    )

  const item = items[index]
  const doc = review.docs[item.id]
  return (
    <>
      <DocumentScreen
        key={item.id}
        year={year}
        item={item}
        doc={doc}
        position={{ at: index + 1, of: items.length }}
        backHref={index > 0 || current === SUMMARY ? backHref : AFTER_FLOW}
        backState={index > 0 ? backState : { fromFlow: true }}
        onNavigate={onNavigate}
        reduce={reduce}
        fixture={!!fixture}
        filesOnServer={!!extraction.documents[item.id]}
        say={say}
        onDone={next}
      />
      {live}
    </>
  )
}

/** Development only: the sample documents load on demand, so they never ship in production */
function devFixtureBackend(name: ReviewFixture): Backend {
  const real: Promise<Backend> = import.meta.env.DEV ? import('./fixtures').then((m) => m.fixtureBackend(name)) : Promise.reject(new Error('dev only'))
  return {
    list: async () => (await real).list(),
    save: async (id, body) => (await real).save(id, body),
    reveal: async (id, key) => (await real).reveal(id, key),
  }
}

function Heading({ children }: { children: string }) {
  return (
    <h1 id={HEADING_ID} tabIndex={-1} className="font-display text-display text-balance outline-none">
      {children.replace(/(\S)-(?=\S)/g, '$1⁠-⁠')}
    </h1>
  )
}

type ScreenProps = {
  year: number
  item: Item
  doc: ReviewDoc | undefined
  position: { at: number; of: number }
  backHref: string
  backState?: Record<string, unknown>
  onNavigate: (section: number) => void
  reduce: boolean
  fixture: boolean
  filesOnServer: boolean
  say: (m: string) => void
  onDone: () => void
}

function DocumentScreen({ year, item, doc, position, backHref, backState, onNavigate, reduce, fixture, filesOnServer, say, onDone }: ScreenProps) {
  const [sheet, setSheet] = useState<'file' | 'replace' | null>(null)
  const [saveError, setSaveError] = useState(false)
  const flushers = useRef(new Map<string, () => Promise<void>>())
  const name = item.form

  // Not read yet (e.g. the server restarted): read it now
  const asked = useRef(false)
  useEffect(() => {
    if (fixture || asked.current || !doc || doc.reading || doc.manual) return
    asked.current = true
    void retryReading(year, item.id)
  }, [fixture, doc, year, item.id])

  const save = async (key: string, patch: FieldPatch) => {
    const ok = await saveReview(item.id, { fields: { [key]: patch } })
    setSaveError(ok !== true)
    if (ok !== true) say('We couldn’t save that change. Check your connection and try again.')
    return ok === true
  }
  const setStatus = async (status: 'confirmed' | 'skipped') => {
    await Promise.all([...flushers.current.values()].map((f) => f()))
    const ok = await saveReview(item.id, { status })
    if (ok === true) {
      say(status === 'confirmed' ? `${name} confirmed` : `${name} skipped for now`)
      onDone()
    } else say(ok === 'not-done' ? 'Some details still need checking.' : 'We couldn’t save that. Try again.')
  }

  // Say once when everything is done
  const fields = doc?.fields ?? null
  const left = fields ? leftLine(fields) : null
  const ready = canConfirm(fields)
  const wasReady = useRef(ready)
  useEffect(() => {
    if (ready && !wasReady.current) say('Everything is checked. You can confirm.')
    wasReady.current = ready
  })

  const header = (
    <>
      <Indicator at={position.at} of={position.of} />
      <Heading>{`Check your ${spoken(name)}`}</Heading>
      <p className="text-small text-text-muted">{doc?.manual ? 'Type each detail from your document.' : 'Check each detail against your document.'}</p>
    </>
  )

  const skip = (
    <button type="button" onClick={() => void setStatus('skipped')} className={`flex min-h-12 items-center self-start rounded-sm text-body font-semibold underline underline-offset-4 ${focusRing}`}>
      Skip this document for now
    </button>
  )

  const failed = !fields && doc?.reading?.status === 'failed'
  const wrongKind = failed && ['wrong-type', 'blurry', 'rotated'].includes(doc?.reading?.failure ?? '')
  const enterMyself = async () => {
    await saveReview(item.id, { manual: true })
    say('The details are empty. Type each one from your document.')
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-needs] input, [data-needs] button')?.focus())
  }

  let body
  if (fields) {
    body = (
      <div className="flex flex-col gap-8">
        {/* Phone: the file opens in a sheet */}
        <div className="tablet:hidden">
          <SecondaryButton onClick={() => setSheet('file')}>View document</SecondaryButton>
        </div>
        <ul aria-label={`Details from your ${spoken(name)}`} className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-decorative bg-surface px-4">
          {fields.map((f) => (
            <FieldRow key={f.key} itemId={item.id} f={f} manual={!!doc?.manual} save={save} say={say} registerFlush={(k, fn) => (fn ? flushers.current.set(k, fn) : flushers.current.delete(k))} />
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <PrimaryButton disabled={!ready} onClick={() => void setStatus('confirmed')}>
            Confirm and continue
          </PrimaryButton>
          <p className="min-h-5 text-small text-text-muted tabular-nums">{saveError ? 'We couldn’t save your last change.' : (left ?? 'Everything is checked.')}</p>
          {skip}
        </div>
      </div>
    )
  } else if (failed) {
    body = (
      <div className="flex flex-col gap-6">
        <div role="status" className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface p-4">
          <p className="flex items-center gap-2 text-body font-semibold text-error">
            <WarningCircleIcon size={24} weight="regular" aria-hidden />
            {wrongKind && doc?.reading?.failure === 'wrong-type' ? 'Wrong document' : 'Couldn’t read'}
          </p>
          <p className="text-body">{failureLine(doc!, name)}</p>
        </div>
        <div className="flex flex-col gap-2">
          {wrongKind ? (
            <>
              <PrimaryButton onClick={() => setSheet('replace')}>Replace file</PrimaryButton>
              <SecondaryButton onClick={() => void enterMyself()}>Enter it myself</SecondaryButton>
            </>
          ) : (
            <>
              <PrimaryButton onClick={() => void enterMyself()}>Enter it myself</PrimaryButton>
              <SecondaryButton onClick={() => (fixture ? undefined : void retryReading(year, item.id))}>Try again</SecondaryButton>
              <SecondaryButton onClick={() => setSheet('replace')}>Replace file</SecondaryButton>
            </>
          )}
          {skip}
        </div>
      </div>
    )
  } else {
    // Being read (after Replace, or catching up)
    const st = doc?.reading?.status
    const stage = st === 'checking' ? 'extracting' : st === 'ready' ? 'done' : 'reading'
    body = (
      <div className="flex flex-col gap-6">
        <ReadingPill stage={stage} label={stage === 'extracting' ? 'Extracting your details' : stage === 'done' ? 'Done' : 'Reading your document'} reduce={reduce} onSettled={() => {}} />
        <p className="text-small text-text-muted">The details show here as soon as they’re read.</p>
        {skip}
      </div>
    )
  }

  return (
    <>
      <ReviewLayout year={year} backHref={backHref} backState={backState} header={header} file={<FilePreview name={name} files={item.files.length} />} onNavigate={onNavigate}>
        {body}
      </ReviewLayout>
      <AnimatePresence>
        {sheet === 'file' && (
          <BottomSheet title={name} onClose={() => setSheet(null)}>
            <div className="pb-4">
              <FilePreview name={name} files={item.files.length} />
            </div>
          </BottomSheet>
        )}
        {sheet === 'replace' && item.doc && !fixture && (
          <DocumentUploadSheet
            item={item.doc}
            onClose={() => {
              setSheet(null)
              // A new file: its earlier reading was dropped by the upload. Read it now.
              if (!filesOnServer) void retryReading(year, item.id)
              void refreshReview()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

const SUMMARY_ICON: Record<SummaryStatus, typeof CheckIcon> = {
  confirmed: CheckIcon,
  skipped: CircleDashedIcon,
  'to-check': CircleDashedIcon,
  reading: CircleDashedIcon,
  'couldnt-read': WarningCircleIcon,
  'wrong-type': WarningCircleIcon,
}
const SUMMARY_COLOR: Record<SummaryStatus, string> = { confirmed: 'text-success', skipped: 'text-text', 'to-check': 'text-text', reading: 'text-text', 'couldnt-read': 'text-error', 'wrong-type': 'text-error' }

function Summary({ year, items, docs, backState, onNavigate, onEdit }: { year: number; items: Item[]; docs: Record<string, ReviewDoc>; backState?: Record<string, unknown>; onNavigate: (s: number) => void; onEdit: (id: string) => void }) {
  return (
    <ReviewLayout
      year={year}
      backHref={REVIEW_PATH}
      backState={backState}
      onNavigate={onNavigate}
      header={
        <>
          <Heading>Your details</Heading>
          <p className="text-small text-text-muted">Here’s each document and where it stands.</p>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <ul aria-label="Your documents" className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-decorative bg-surface px-4">
          {items.map((i) => {
            const d = docs[i.id]
            const st: SummaryStatus = d ? summaryStatus(d) : 'reading'
            const Icon = SUMMARY_ICON[st]
            return (
              <li key={i.id} className="flex min-h-18 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold">{i.form.replace(/(\S)-(?=\S)/g, '$1⁠-⁠')}</span>
                  <span className={`flex items-center gap-2 text-small font-semibold ${SUMMARY_COLOR[st]}`}>
                    <Icon size={24} weight="regular" aria-hidden />
                    {SUMMARY_TEXT[st]}
                  </span>
                </div>
                <button type="button" onClick={() => onEdit(i.id)} className={`flex min-h-11 items-center rounded-sm px-1 text-body font-semibold underline underline-offset-4 ${focusRing}`}>
                  {st === 'confirmed' ? 'Edit' : 'Check'}
                  <span className="sr-only"> {i.form}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <PrimaryButton onClick={() => navigate(RESULT_PATH)}>Looks good</PrimaryButton>
      </div>
    </ReviewLayout>
  )
}
