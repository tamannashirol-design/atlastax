import { useEffect, useRef } from 'react'
import { useUpload } from '../lib/upload'
import { UploadZone } from './UploadZone'

// The one upload control used everywhere a file can be uploaded (question
// screens and sheets): the folder UploadZone + a real upload.
// - Calls onUploaded(name) only when the server confirms the upload, so
//   Continue unlocks on a real upload, never a timer.
// - Coming back to the question shows what was already uploaded.
// - allowAnother: offer "Add another file" after each upload.

type Props = {
  docLabel: string
  /** Names already uploaded for this question */
  uploaded: string[]
  onUploaded: (name: string) => void
  allowAnother?: boolean
}

export function UploadAnswer({ docLabel, uploaded, onUploaded, allowAnother }: Props) {
  const up = useUpload()
  const reported = useRef<string | null>(null)

  useEffect(() => {
    if (up.status === 'done' && up.file && reported.current !== up.file.name + up.file.size) {
      reported.current = up.file.name + up.file.size
      onUploaded(up.file.name)
    }
  }, [up.status, up.file, onUploaded])

  // Nothing in progress, but files were uploaded earlier: show them as done
  const remembered = up.status === 'idle' && uploaded.length > 0
  return (
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
  )
}
