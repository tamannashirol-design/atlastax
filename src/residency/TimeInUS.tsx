import { CheckIcon, PlusIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { AnimatePresence } from 'framer-motion'
import { useRef, useState, type ReactNode } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/SecondaryButton'
import { fieldClass } from '../components/SelectField'
import { TileGroup } from '../components/TileGroup'
import { UploadAnswer } from '../components/UploadAnswer'
import { CBP_HELPER, STUDENT_LIMIT_YEARS } from '../residency.config'
import { setResidency, useAnswers } from '../flow/answers'
import { Link } from '../lib/router'
import { UploadHostContext } from '../lib/uploadHost'
import { extractTravelHistoryStub, tripsFromTravelHistory, type AbroadTrip, type Flag } from './days'
import { asksArrivalDate, daysFor, studentYearsFor } from './fromAnswers'
import { inputClass, quietButton, smallButton } from './fields'

// The answer controls of the "Time in the U.S." section. Each sits in the
// standard question layout (one question per screen). Only dates matter:
// no places, no visa lists. Focus never drops to the page body: when a
// pressed control disappears, focus moves to its row (or the next field) first.

const yesNo = [
  { value: 'yes', code: 'Yes' },
  { value: 'no', code: 'No' },
]
const newId = () => Math.random().toString(36).slice(2, 9)
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// ---------- 2. Arrival date ----------

export function ArrivalDate({ labelledBy, year, value, onChange }: { labelledBy: string; year: number; value: string; onChange: (v: string) => void }) {
  const outside = !!value && !value.startsWith(String(year))
  return (
    <div className="flex flex-col gap-2">
      <input
        type="date"
        aria-labelledby={labelledBy}
        aria-describedby={outside ? `${labelledBy}-error` : undefined}
        min={`${year}-01-01`}
        max={`${year}-12-31`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} tabular-nums`}
      />
      {outside && <FlagLine id={`${labelledBy}-error`} message={`Pick a date in ${year}, the year you arrived.`} />}
    </div>
  )
}

// ---------- 3. A full year abroad ----------

export function YearAbroad({ labelledBy, taxYear }: { labelledBy: string; taxYear: number }) {
  const r = useAnswers().residency ?? {}
  const from = (r.arrivalYear ?? taxYear) + 1
  const years: number[] = []
  for (let y = from; y <= taxYear; y++) years.push(y)
  const picked = r.abroadYears ?? []
  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-(--answer-h) flex-col">
        <TileGroup labelledBy={labelledBy} value={r.yearAbroad} onChange={(v) => setResidency({ yearAbroad: v as 'yes' | 'no' })} options={yesNo} />
      </div>
      {r.yearAbroad === 'yes' && (
        <section aria-labelledby={`${labelledBy}-years`} className="flex flex-col gap-3">
          <h2 id={`${labelledBy}-years`} className="text-body font-semibold">
            Which years were you away the whole year?
          </h2>
          <ul className="flex flex-wrap gap-2">
            {years.map((y) => {
              const on = picked.includes(y)
              return (
                <li key={y} className="flex">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setResidency({ abroadYears: on ? picked.filter((x) => x !== y) : [...picked, y].sort() })}
                    className={`flex h-11 items-center gap-2 rounded-sm border px-4 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100 ${
                      on ? 'border-text bg-surface shadow-[inset_0_0_0_1px_var(--color-text)]' : 'border-border-strong bg-surface'
                    }`}
                  >
                    {on && <CheckIcon size={24} weight="regular" aria-hidden />}
                    <span className="tabular-nums">{y}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---------- 4. Trips out of the U.S. ----------

export function TripsStep({ labelledBy, taxYear }: { labelledBy: string; taxYear: number }) {
  const answers = useAnswers()
  const r = answers.residency ?? {}
  const trips = r.trips ?? []
  const state = daysFor(answers, taxYear)
  const [announce, setAnnounce] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  // The travel-history upload mounts only once its section is opened, so the consent sheet
  // appears when the zone would first show, not when the page loads
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyRef = useRef<HTMLDetailsElement>(null)
  const setTrips = (t: AbroadTrip[]) => setResidency({ trips: t })
  const flagFor = (id: string) => state?.flags.find((f) => f.tripId === id)
  const cutOff = state?.flags.find((f) => f.kind === 'maybe-cut-off')

  const add = () => {
    const t = { id: newId(), left: '', back: '' }
    setTrips([...trips, t])
    requestAnimationFrame(() => document.getElementById(`trip-${t.id}-left`)?.focus())
    setAnnounce('Trip added')
  }
  const remove = (id: string) => {
    const i = trips.findIndex((t) => t.id === id)
    const next = trips[i + 1] ?? trips[i - 1]
    document.getElementById(next ? `trip-${next.id}-left` : 'add-trip')?.focus()
    setTrips(trips.filter((t) => t.id !== id))
    setAnnounce('Trip deleted')
  }
  const update = (id: string, patch: Partial<AbroadTrip>) => setTrips(trips.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const files = r.cbpFiles ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-(--answer-h) flex-col">
        <TileGroup labelledBy={labelledBy} value={r.left} onChange={(v) => setResidency({ left: v as 'yes' | 'no' })} options={yesNo} />
      </div>
      {r.left === 'no' && <p className="text-small text-text-muted">We’ll count every day from when you arrived to the end of each year.</p>}

      {r.left === 'yes' && (
        <section aria-labelledby="trips-title" className="flex flex-col gap-4">
          <h2 id="trips-title" className="text-body font-semibold">
            Your trips out of the U.S.
          </h2>
          {cutOff && (
            <div className="rounded-md border border-text bg-sage-100 p-3">
              <FlagLine message={cutOff.message}>
                <button type="button" onClick={add} className={quietButton}>
                  Add an earlier trip
                </button>
              </FlagLine>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {trips.map((t, n) => {
              const flag = flagFor(t.id)
              return (
                <li
                  key={t.id}
                  id={`trip-${t.id}`}
                  tabIndex={-1}
                  className={`flex flex-col gap-3 rounded-md border p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text ${flag ? 'border-text bg-sage-100' : 'border-border-strong bg-surface'}`}
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-1 basis-36 flex-col gap-1 text-small text-text-muted">
                      Left on
                      <input id={`trip-${t.id}-left`} type="date" value={t.left} onChange={(e) => update(t.id, { left: e.target.value })} className={`${inputClass} text-text tabular-nums`} />
                    </label>
                    {t.back === null ? (
                      <p className="flex min-h-11 flex-1 basis-36 flex-wrap items-center gap-x-3 text-body">
                        Still outside the U.S.
                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById(`trip-${t.id}`)?.focus()
                            update(t.id, { back: '' })
                          }}
                          className={quietButton}
                        >
                          Undo
                        </button>
                      </p>
                    ) : (
                      <label className="flex flex-1 basis-36 flex-col gap-1 text-small text-text-muted">
                        Came back on
                        <input id={`trip-${t.id}-back`} type="date" value={t.back} onChange={(e) => update(t.id, { back: e.target.value })} className={`${inputClass} text-text tabular-nums`} />
                      </label>
                    )}
                    <button type="button" onClick={() => remove(t.id)} aria-label={`Delete trip ${n + 1}`} className={`${smallButton} px-3`}>
                      <TrashIcon size={24} weight="regular" aria-hidden />
                    </button>
                  </div>
                  {flag && (
                    <FlagLine message={flag.message}>
                      {flag.kind === 'no-return' && (
                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById(`trip-${t.id}`)?.focus()
                            update(t.id, { back: null })
                          }}
                          className={quietButton}
                        >
                          Yes, I’m still away
                        </button>
                      )}
                    </FlagLine>
                  )}
                </li>
              )
            })}
          </ul>
          <button id="add-trip" type="button" onClick={add} className={`self-start ${smallButton}`}>
            <PlusIcon size={24} weight="regular" aria-hidden />
            {trips.length ? 'Add another' : 'Add a trip'}
          </button>

          <details ref={historyRef} className="flex flex-col" open={files.length > 0} onToggle={(e) => setHistoryOpen(e.currentTarget.open)}>
            <summary className="flex min-h-11 cursor-pointer items-center rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
              Fill this in from your I-94 travel history
            </summary>
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-small text-text-muted">{CBP_HELPER}</p>
              {(historyOpen || files.length > 0) && (
              <UploadHostContext.Provider
                // "Not now" on the consent sheet folds this section away again
                value={{
                  close: () => {
                    if (historyRef.current) historyRef.current.open = false
                    historyRef.current?.querySelector('summary')?.focus()
                  },
                }}
              >
              <UploadAnswer
                docLabel="travel history"
                uploaded={files}
                allowAnother
                upload={{ key: 'cbp-history' }}
                onUploaded={(name) => {
                  // TODO: real reading (OCR) comes later; the trips read are sample data for now
                  const { trips: read, cutOff } = tripsFromTravelHistory(extractTravelHistoryStub(r.arrivalYear ?? taxYear, taxYear), r.arrivalYear ?? taxYear)
                  setResidency({ cbpFiles: [...files, name], trips: [...trips.filter((t) => !t.fromHistory), ...read], historyCutOff: cutOff })
                  setAnnounce(`${read.length} trips read from your travel history. Check them.`)
                }}
                onRemove={(i) => {
                  const left = files.filter((_, j) => j !== i)
                  // Removing the last file also removes the trips read from it
                  setResidency(left.length ? { cbpFiles: left } : { cbpFiles: [], trips: trips.filter((t) => !t.fromHistory), historyCutOff: false })
                }}
              />
              </UploadHostContext.Provider>
              )}
              {files.length > 0 && (
                <>
                  <p className="flex items-start gap-2 text-small">
                    <WarningCircleIcon size={24} weight="regular" aria-hidden className="shrink-0" />
                    Sample trips: reading your file isn’t built yet. Check each trip above.
                  </p>
                  <button type="button" onClick={() => setConfirmRemove(true)} className={`self-start text-error ${quietButton}`}>
                    Remove travel history
                  </button>
                </>
              )}
            </div>
          </details>
        </section>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <AnimatePresence onExitComplete={() => document.getElementById('add-trip')?.focus()}>
        {confirmRemove && (
          <BottomSheet title="Remove your travel history?" onClose={() => setConfirmRemove(false)}>
            <p className="text-body text-text-muted">This deletes the uploaded travel history files and the trips read from them. Trips you added yourself stay.</p>
            <div className="flex flex-col gap-2 pt-8">
              <SecondaryButton
                tone="destructive"
                onClick={() => {
                  setResidency({ cbpFiles: [], trips: trips.filter((t) => !t.fromHistory), historyCutOff: false })
                  setAnnounce('Travel history removed')
                  setConfirmRemove(false)
                }}
              >
                Remove travel history
              </SecondaryButton>
              <SecondaryButton onClick={() => setConfirmRemove(false)}>Keep it</SecondaryButton>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------- 5. Summary ----------

export function TimeSummary({ taxYear }: { taxYear: number }) {
  const a = useAnswers()
  const sy = studentYearsFor(a, taxYear)
  const days = daysFor(a, taxYear)
  if (!sy || !days) return null
  const arrivalYear = a.residency!.arrivalYear!
  const editHref = (y: number) => (y === arrivalYear && asksArrivalDate(a, taxYear) ? '/arrival-date' : '/trips')

  return (
    <div className="flex flex-col gap-8">
      {/* Only reached within scope (outside scope the flow stops before this section's later screens) */}
      <p className="text-body font-semibold tabular-nums">
        {taxYear}: year {sy.yearNumber} of your first {STUDENT_LIMIT_YEARS} calendar years as a student.
      </p>

      <section aria-labelledby="summary-days" className="flex flex-col gap-2">
        <h2 id="summary-days" className="text-body font-semibold">
          Your days in the U.S.
        </h2>
        <ul className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-strong bg-surface">
          {days.working.map((w) => (
            <li key={w.year} className="flex min-h-14 items-center justify-between gap-4 py-1 pr-1 pl-4 tabular-nums">
              <span className="text-body">
                {w.year}: <span className="font-semibold">{w.days} days</span>
              </span>
              <Link href={editHref(w.year)} className={`min-w-12 ${quietButton}`}>
                Edit<span className="sr-only"> days in {w.year}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-small text-text-muted">These go on Form 8843, which asks for your days in the U.S. in each of these years.</p>
      </section>

      <details>
        <summary className="flex min-h-11 cursor-pointer items-center rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
          Show how we counted
        </summary>
        <div className="flex flex-col gap-4 pt-2 text-small">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Student years</p>
            <p className="tabular-nums">
              You arrived in {arrivalYear}. Counted: {sy.counted.join(', ')} ({sy.counted.length}).
              {sy.notCounted.length > 0 && ` Not counted (a full year away): ${sy.notCounted.join(', ')}.`} The first {STUDENT_LIMIT_YEARS} count as student years. Any part of a year counts.
            </p>
          </div>
          {days.working.map((w) => (
            <div key={w.year} className="flex flex-col gap-1">
              <p className="font-semibold tabular-nums">
                {w.year}: {w.days} of {w.daysInYear} days in the U.S.
              </p>
              {w.stays.length ? (
                <ul className="flex flex-col gap-1 tabular-nums text-text-muted">
                  {w.stays.map((s) => (
                    <li key={s.from}>
                      In the U.S. {fmt(s.from)} – {fmt(s.to)}: {s.days} {s.days === 1 ? 'day' : 'days'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted">Outside the U.S. the whole year.</p>
              )}
            </div>
          ))}
          <p className="text-text-muted">Any part of a day counts, so the days you left and came back are days in the U.S. A date is never counted twice.</p>
        </div>
      </details>
    </div>
  )
}

/** "Needs attention" line: text + icon, never color alone. Exported for the style guide. */
export function FlagLine({ message, children, id }: { message: string; children?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p id={id} className="flex items-start gap-2 text-small font-semibold">
        <WarningCircleIcon size={24} weight="regular" aria-hidden className="shrink-0" />
        <span>
          <span className="sr-only">Needs your attention: </span>
          {message}
        </span>
      </p>
      {children && <div className="flex flex-wrap gap-x-4 pl-8">{children}</div>}
    </div>
  )
}

export type { Flag }
