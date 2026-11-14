// Real upload with real progress (XMLHttpRequest upload events). The UI never
// fakes progress: every percentage comes from bytes the browser has sent.
//   accepted  → file chosen, request opening (card settles in)
//   uploading → bytes going out; progress 0–1 (at 1 = "finishing": waiting for the server)
//   done      → server answered OK
//   error     → network error, server error, or a file type we can't take
import { useCallback, useEffect, useRef, useState } from 'react'

export type UploadStatus = 'idle' | 'accepted' | 'uploading' | 'done' | 'error'
/** size is unknown for files remembered from an earlier visit */
export type UploadFile = { name: string; size?: number }
export type UploadState = { status: UploadStatus; progress: number; file?: UploadFile; error?: string }

const ACCEPTED = /^(application\/pdf|image\/)/

export function useUpload(endpoint = '/api/upload') {
  const [state, setState] = useState<UploadState>({ status: 'idle', progress: 0 })
  const xhr = useRef<XMLHttpRequest | null>(null)
  const last = useRef<{ file: File; query: string } | null>(null)

  const start = useCallback(
    (file: File, query = '') => {
      xhr.current?.abort()
      if (!ACCEPTED.test(file.type)) {
        setState({ status: 'error', progress: 0, file: { name: file.name, size: file.size }, error: 'That file type isn’t supported. Use a PDF or a photo.' })
        return
      }
      last.current = { file, query }
      setState({ status: 'accepted', progress: 0, file: { name: file.name, size: file.size } })
      const req = new XMLHttpRequest()
      xhr.current = req
      req.upload.onprogress = (e) => {
        if (e.lengthComputable) setState((s) => ({ ...s, status: 'uploading', progress: e.loaded / e.total }))
      }
      req.onload = () =>
        setState((s) => (req.status >= 200 && req.status < 300 ? { ...s, status: 'done', progress: 1 } : { ...s, status: 'error', error: undefined }))
      req.onerror = () => setState((s) => ({ ...s, status: 'error', error: undefined }))
      req.open('POST', endpoint + query)
      req.send(file)
    },
    [endpoint],
  )

  /** Try the last file again (without any test flags). */
  const retry = useCallback(() => last.current && start(last.current.file), [start])

  const reset = useCallback(() => {
    xhr.current?.abort()
    setState({ status: 'idle', progress: 0 })
  }, [])

  useEffect(() => () => xhr.current?.abort(), [])

  return { ...state, start, retry, reset }
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
