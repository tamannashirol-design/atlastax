import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { spring } from '../lib/motion'
import { consentLoaded, consentRefused, giveConsent, loadConsent, useConsent } from '../consent/client'
import { ConsentSheet } from '../consent/ConsentSheet'
import { consentCheckFailed, consentNeeded, consentSheetOpen, uploadsBlocked } from '../consent/logic'
import { deleteFile } from '../extraction/client'
import { rememberFileId, takeFileId, useFilingYear } from '../flow/answers'
import { useUpload, type UploadMeta } from '../lib/upload'
import { useUploadHost } from '../lib/uploadHost'
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
// - upload: where the files' server ids are kept (`key`, the same name as the
//   caller's list of file names) and which Documents item they're for
//   (`itemId`, which starts reading them on the server). Remove also deletes
//   the file from the server. Without it (style guide demos) uploads are
//   measured only and never stored.
// - Consent (EXTRACTION-PLAN.md §4, rules in src/consent/logic.ts): with `upload`,
//   no file is sent at all (no bytes leave the browser) until the server has
//   CONFIRMED agreement to the current notice. While we don't know yet, a chosen or
//   dropped file waits. If the status can't be loaded, the zone is replaced by
//   "We couldn't check your privacy settings." + Try again, and files keep waiting.
//   The consent sheet opens over this control the first time it shows; "Continue
//   to upload" starts the waiting file and moves focus to the zone; "Not now" closes
//   the sheet (and whatever opened this, through UploadHostContext, if it provides
//   a close) and nothing is uploaded. A dropped file is sent once, never again on a
//   later agreement. If the server still refuses a file (new notice, lost cookie),
//   or an upload fails and the agreement turns out to be gone, the sheet asks again
//   and the same file is retried after agreeing. The server refuses without
//   agreement too.
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
  /** Keep the files on the server: `key` = where their ids are kept, `itemId` = the document to read */
  upload?: { key: string; itemId?: string }
}

export function UploadAnswer({ docLabel, uploaded, onUploaded, onRemove, allowAnother, initialFile, upload }: Props) {
  const year = useFilingYear()
  const consent = useConsent()
  const host = useUploadHost()
  const stores = !!upload
  // Nothing is sent until the server confirmed agreement (or that none is needed)
  const blocked = stores && uploadsBlocked(consent)
  const checkFailed = stores && consentCheckFailed(consent)
  // "Not now" closes the sheet, whoever opened this; it opens again only when the person tries to upload
  const [declined, setDeclined] = useState(false)
  const askingForConsent = consentSheetOpen(consent, { stores, declined })
  const afterConsent = useRef<() => void>(() => {})
  // A file chosen or dropped before agreement was confirmed: sent only after it is
  const waitingFile = useRef<File | null>(null)
  // The file the server refused (or that failed while the agreement was gone): retried after agreeing
  const retryAfterAgree = useRef(false)
  // The dropped file (initialFile) is sent once, never again on a later agreement
  const sentInitial = useRef<File | null>(null)
  const askAgain = () => {
    setDeclined(false)
    retryAfterAgree.current = true
  }
  const up = useUpload(undefined, {
    onNeedsConsent: () => {
      consentRefused()
      askAgain()
    },
    // A failed upload may mean the agreement was lost: check again; if it's now needed, ask, then retry
    onFailed: () => {
      if (!stores) return
      void loadConsent(true).then(() => {
        if (consentNeeded(consentLoaded())) askAgain()
      })
    },
  })
  const checkMessage = useRef<HTMLParagraphElement>(null)
  const meta: UploadMeta = { itemId: upload?.itemId, year }
  const query = upload ? '' : '?dry=1'
  // Read in the effect below without re-running it on every render
  const latest = useRef({ meta, query, key: upload?.key, count: uploaded.length })
  useLayoutEffect(() => {
    latest.current = { meta, query, key: upload?.key, count: uploaded.length }
  })
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

  // A dropped file uploads as soon as agreement is confirmed (a real upload, same rules), exactly once:
  // if the agreement is asked for again later, it is not sent a second time.
  const { start } = up
  useEffect(() => {
    if (initialFile && !blocked && sentInitial.current !== initialFile) {
      sentInitial.current = initialFile
      start(initialFile, latest.current.query, latest.current.meta)
    }
  }, [initialFile, start, blocked])

  // The privacy check failed: focus its message (the zone is gone). When it recovers, back to the zone.
  const wasCheckFailed = useRef(false)
  useLayoutEffect(() => {
    if (checkFailed && !wasCheckFailed.current) checkMessage.current?.focus()
    if (!checkFailed && wasCheckFailed.current && !askingForConsent) zoneButton()?.focus()
    wasCheckFailed.current = checkFailed
  }, [checkFailed, askingForConsent])

  // A file chosen while we didn't know yet whether consent is needed: it starts as soon as we know it isn't
  useEffect(() => {
    if (!blocked && !askingForConsent && waitingFile.current) {
      const f = waitingFile.current
      waitingFile.current = null
      reported.current = null
      start(f, latest.current.query, latest.current.meta)
    }
  }, [blocked, askingForConsent, start])

  const agree = async () => {
    // Take the waiting file BEFORE agreeing, so the effect above can't also start it
    const f = waitingFile.current
    waitingFile.current = null
    const result = await giveConsent()
    if (result !== 'agreed') {
      // Nothing recorded ("changed": the new words are showing; "failed": try again). The file keeps waiting.
      waitingFile.current = f
      return result
    }
    const retry = retryAfterAgree.current
    retryAfterAgree.current = false
    // Once the sheet has finished leaving: focus the zone, then send the waiting file (or the refused one again)
    afterConsent.current = () => {
      zoneButton()?.focus()
      if (f) {
        reported.current = null
        up.start(f, latest.current.query, latest.current.meta)
      } else if (retry) up.retry()
    }
    return result
  }
  const decline = () => {
    waitingFile.current = null
    retryAfterAgree.current = false
    // Nothing closes us (no host): focus goes back to the zone once the sheet has left
    afterConsent.current = host ? () => {} : () => zoneButton()?.focus()
    setDeclined(true)
    host?.close()
  }

  useEffect(() => {
    if (up.status === 'done' && up.file && reported.current !== up.file.name + up.file.size) {
      reported.current = up.file.name + up.file.size
      focusNewRow.current = true
      setAnnounce(`${up.file.name} uploaded`)
      // Its server id goes in the same position as its name (the caller appends the name)
      const { key, count } = latest.current
      if (key && up.file.fileId) rememberFileId(key, count, up.file.fileId)
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
    if (upload) {
      const id = takeFileId(upload.key, i)
      if (id) void deleteFile(id)
    }
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
        {checkFailed ? (
          // We couldn't ask the server whether this person agreed: hold everything, offer Try again
          <div className="flex flex-1 flex-col items-start justify-center gap-4 rounded-md border border-border-strong bg-surface p-6">
            <p ref={checkMessage} tabIndex={-1} role="alert" className="rounded-sm text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
              We couldn’t check your privacy settings.
            </p>
            <SecondaryButton onClick={() => void loadConsent(true)}>Try again</SecondaryButton>
          </div>
        ) : (
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
            // Agreement not confirmed yet: keep the file here and ask (no bytes are sent before agreeing)
            if (stores && uploadsBlocked(consent)) {
              waitingFile.current = files[0]
              setDeclined(false)
              if (consent.status !== 'ready') void loadConsent()
              return
            }
            up.start(files[0], query, meta)
          }}
          onRetry={up.retry}
          managed
        />
        )}
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

      <AnimatePresence onExitComplete={() => afterConsent.current()}>
        {askingForConsent && consent.notice && <ConsentSheet key="consent" mode="ask" notice={consent.notice} changed={!!consent.changed} onAgree={agree} onDecline={decline} />}
      </AnimatePresence>

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
