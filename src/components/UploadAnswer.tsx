import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
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
//   onRemove(index). Screen readers hear "Removed <file>. N files left." and
//   focus moves to the next file's Remove button, or back to the zone.
//   Removing the last file returns the zone to its empty state.
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
}

export function UploadAnswer({ docLabel, uploaded, onUploaded, onRemove, allowAnother }: Props) {
  const up = useUpload()
  const reduce = useReducedMotionConfig() ?? false
  const reported = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const [confirm, setConfirm] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')
  // Where focus goes once the confirmation sheet has closed
  const focusNext = useRef<() => void>(() => {})

  useEffect(() => {
    if (up.status === 'done' && up.file && reported.current !== up.file.name + up.file.size) {
      reported.current = up.file.name + up.file.size
      onUploaded(up.file.name)
    }
  }, [up.status, up.file, onUploaded])

  const removeButton = (i: number) => root.current?.querySelectorAll<HTMLButtonElement>('[data-remove]')[i]
  const zoneButton = () => root.current?.querySelector<HTMLButtonElement>('[data-upload-action]:not([inert] *)')

  const ask = (i: number) => {
    focusNext.current = () => removeButton(i)?.focus() // "Keep file": back to the same Remove button
    setConfirm(i)
  }

  const remove = (i: number) => {
    const name = uploaded[i]
    const left = uploaded.length - 1
    // The zone shows the newest remaining file (or its empty state), not the one that was just uploaded
    up.reset()
    reported.current = null
    onRemove(i)
    setAnnounce(`Removed ${name}. ${left === 0 ? 'No files uploaded.' : left === 1 ? '1 file left.' : `${left} files left.`}`)
    // Next file's Remove (it slides into this row), else the one above, else the zone
    focusNext.current = () => (left > 0 ? removeButton(Math.min(i, left - 1))?.focus() : zoneButton()?.focus())
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
          count={Math.max(1, uploaded.length)}
          allowAnother={allowAnother}
          onFiles={(files) => {
            reported.current = null
            up.start(files[0])
          }}
          onRetry={up.retry}
        />
      </div>

      {uploaded.length > 0 && (
        <ul aria-label={`Uploaded ${docLabel} files`} className="flex flex-col divide-y divide-border-decorative rounded-md border border-border-strong bg-surface">
          <AnimatePresence initial={false}>
            {uploaded.map((name, i) => (
              <motion.li
                key={`${i}-${name}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? spring.fade : spring.soft}
                className="flex min-h-14 items-center gap-4 pr-1 pl-4"
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
