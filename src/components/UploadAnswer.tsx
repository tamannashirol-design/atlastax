import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { spring } from '../lib/motion'
import { useUpload } from '../lib/upload'
import { BottomSheet } from './BottomSheet'
import { SecondaryButton } from './SecondaryButton'
import { UploadZone } from './UploadZone'

// The one upload control used everywhere a file can be uploaded (question
// screens and sheets): the folder UploadZone + a real upload, and below it the
// list of uploaded files, each with a "Remove" button.
// - Calls onUploaded(name) only when the server confirms the upload, so
//   Continue unlocks on a real upload, never a timer.
// - Coming back to the question shows what was already uploaded.
// - allowAnother: offer "Add another file" after each upload.
// - Remove: asks first (a sheet naming the exact file), then calls
//   onRemove(index). Removing the last file returns the zone to its empty state.
//
// Focus is moved on purpose at every step, because the button that started
// each step disappears (it must never fall back to the page body):
//   upload starts  → the zone's status message ("Uploading W-2, 40%")
//   upload done    → the new file's row in the list; "<file> uploaded" is announced
//   upload failed  → the error message (Try again follows it)
//   file removed   → "Choose a file" (or "Add another file" if files remain); "<file> removed" is announced
//   Keep file      → back to the same Remove button
//
//   zone      fixed --answer-h-upload (296), so empty screens line up
//   gap 16
//   file list one row per file, min 56pt (only when files exist). Long names
//             wrap instead of truncating, so people see exactly which file it is.

type Props = {
  docLabel: string
  /** Names already uploaded for this question */
  uploaded: string[]
  onUploaded: (name: string) => void
  onRemove: (index: number) => void
  allowAnother?: boolean
  /** A file dropped somewhere else (e.g. on a Documents card): upload it straight away */
  initialFile?: File
}

export function UploadAnswer({ docLabel, uploaded, onUploaded, onRemove, allowAnother, initialFile }: Props) {
  const up = useUpload()
  const reduce = useReducedMotionConfig() ?? false
  const reported = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const [confirm, setConfirm] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')
  // Where focus goes once the confirmation sheet has closed
  const focusNext = useRef<() => void>(() => {})
  // Set when an upload finishes: focus the new row once it's rendered
  const focusNewRow = useRef(false)
  const lastStatus = useRef(up.status)

  const removeButton = (i: number) => root.current?.querySelectorAll<HTMLButtonElement>('[data-remove]')[i]
  const message = () => root.current?.querySelector<HTMLElement>('[data-upload-message]')
  const zoneButton = () => root.current?.querySelector<HTMLButtonElement>('[data-upload-action]:not([inert] *)')

  // A dropped file starts uploading as soon as the sheet opens (a real upload, same rules).
  // start() is stable and cancels any earlier attempt, so a dev-mode double run is harmless.
  const { start } = up
  useEffect(() => {
    if (initialFile) start(initialFile)
  }, [initialFile, start])

  useEffect(() => {
    if (up.status === 'done' && up.file && reported.current !== up.file.name + up.file.size) {
      reported.current = up.file.name + up.file.size
      focusNewRow.current = true
      setAnnounce(`${up.file.name} uploaded`)
      onUploaded(up.file.name)
    }
  }, [up.status, up.file, onUploaded])

  // Upload started or failed: the button that was pressed is gone, so focus the status message.
  // Layout effect: moves focus before the browser paints, so it never rests on the body.
  useLayoutEffect(() => {
    const was = lastStatus.current
    lastStatus.current = up.status
    if (was !== up.status && (up.status === 'accepted' || up.status === 'error')) message()?.focus()
  }, [up.status])

  // The new row has rendered: focus it
  useLayoutEffect(() => {
    if (!focusNewRow.current) return
    const rows = root.current?.querySelectorAll<HTMLElement>('[data-file-row]')
    if (rows?.length) {
      focusNewRow.current = false
      rows[rows.length - 1].focus()
    }
  }, [uploaded.length])


  const ask = (i: number) => {
    focusNext.current = () => removeButton(i)?.focus() // "Keep file": back to the same Remove button
    setConfirm(i)
  }

  const remove = (i: number) => {
    const name = uploaded[i]
    // The zone shows the newest remaining file (or its empty state), not the one that was just uploaded
    up.reset()
    reported.current = null
    onRemove(i)
    setAnnounce(`${name} removed`)
    // Back to the zone's button: "Choose a file", or "Add another file" while other files remain
    focusNext.current = () => zoneButton()?.focus()
    setConfirm(null)
  }

  // Nothing in progress, but files were uploaded earlier: show them as done
  const remembered = up.status === 'idle' && uploaded.length > 0
  const pending = confirm !== null ? uploaded[confirm] : undefined
  const others = uploaded.length - 1
  return (
    <div ref={root} className="flex flex-col gap-4">
      <div className="flex h-(--answer-h-upload) flex-col">
        <UploadZone
          docLabel={docLabel}
          status={remembered ? 'done' : up.status}
          progress={remembered ? 1 : up.progress}
          file={remembered ? { name: uploaded[uploaded.length - 1] } : up.file}
          error={up.error}
          retryable={up.retryable}
          count={Math.max(1, uploaded.length)}
          allowAnother={allowAnother}
          onFiles={(files) => {
            reported.current = null
            up.start(files[0])
          }}
          onRetry={up.retry}
          managed
        />
      </div>

      {uploaded.length > 0 && (
        <ul aria-label={`Uploaded ${docLabel} files`} className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-strong bg-surface">
          <AnimatePresence initial={false}>
            {uploaded.map((name, i) => (
              <motion.li
                // Stable per file, so removing one row never re-creates the others
                key={`${name}#${uploaded.slice(0, i).filter((n) => n === name).length}`}
                data-file-row
                tabIndex={-1}
                aria-label={`${name}, uploaded`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? spring.fade : spring.soft}
                className="flex min-h-14 items-center gap-4 rounded-md pr-1 pl-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
              >
                <span className="min-w-0 flex-1 text-body [overflow-wrap:anywhere]">{name}</span>
                <button
                  type="button"
                  data-remove
                  onClick={() => ask(i)}
                  className="flex h-11 shrink-0 items-center rounded-sm px-3 text-body font-semibold text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
                >
                  Remove<span className="sr-only"> {name}</span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>

      <AnimatePresence onExitComplete={() => focusNext.current()}>
        {pending !== undefined && (
          <BottomSheet title={`Remove ${pending}?`} onClose={() => setConfirm(null)}>
            <p className="text-body text-text-muted">
              This removes <span className="break-all text-text">{pending}</span> from your {docLabel} upload.{' '}
              {others > 0
                ? `Your other ${others === 1 ? 'file stays' : `${others} files stay`}.`
                : 'It’s the only file here, so this step goes back to empty.'}
            </p>
            <div className="flex flex-col gap-2 pt-8">
              <SecondaryButton tone="destructive" onClick={() => remove(confirm!)}>
                Remove file
              </SecondaryButton>
              <SecondaryButton onClick={() => setConfirm(null)}>Keep file</SecondaryButton>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  )
}
