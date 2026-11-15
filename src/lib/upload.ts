// Real upload with real progress (XMLHttpRequest upload events). The UI never
// fakes progress: every percentage comes from bytes the browser has sent.
//   accepted  → file chosen, request opening (card settles in)
//   uploading → bytes going out; progress 0–1 (at 1 = "finishing": waiting for the server)
//   done      → server answered OK
//   error     → network error, server error, a file type we can't take, or too big
// Files go to our server (POST /api/files, server/app.ts), which checks them
// again and answers with a fileId.
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_UPLOAD_BYTES } from '../config'

export type UploadStatus = 'idle' | 'accepted' | 'uploading' | 'done' | 'error'
/** size is unknown for files remembered from an earlier visit; fileId is set once the server has stored it */
export type UploadFile = { name: string; size?: number; fileId?: string }
/** retryable: the same file can be sent again (network/server failure), not for a file type we can't take */
export type UploadState = { status: UploadStatus; progress: number; file?: UploadFile; error?: string; retryable?: boolean }

/** What the server stores with a file: which document it is and for which tax year */
export type UploadMeta = { itemId?: string; year?: number }

const ACCEPTED = /^(application\/pdf|image\/)/
const TYPE_ERROR = 'That file type isn’t supported. Use a PDF or a photo.'
const SIZE_ERROR = `That file is too big. Use one under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` // TODO confirm copy

export function useUpload(endpoint = '/api/files') {
  const [state, setState] = useState<UploadState>({ status: 'idle', progress: 0 })
  const xhr = useRef<XMLHttpRequest | null>(null)
  const last = useRef<{ file: File; query: string; meta: UploadMeta } | null>(null)

  const start = useCallback(
    /** meta: the Documents item this file is for (e.g. "opt-cpt") and the tax year; together they start reading it */
    (file: File, query = '', meta: UploadMeta = {}) => {
      xhr.current?.abort()
      const refuse = (error: string) => setState({ status: 'error', progress: 0, file: { name: file.name, size: file.size }, error, retryable: false })
      if (!ACCEPTED.test(file.type)) return refuse(TYPE_ERROR)
      if (file.size > MAX_UPLOAD_BYTES) return refuse(SIZE_ERROR)
      last.current = { file, query, meta }
      setState({ status: 'accepted', progress: 0, file: { name: file.name, size: file.size } })
      const req = new XMLHttpRequest()
      xhr.current = req
      req.upload.onprogress = (e) => {
        if (e.lengthComputable) setState((s) => ({ ...s, status: 'uploading', progress: e.loaded / e.total }))
      }
      req.onload = () => {
        if (req.status >= 200 && req.status < 300) {
          let fileId: string | undefined
          try {
            fileId = (JSON.parse(req.responseText) as { fileId?: string }).fileId
          } catch {
            /* no id: still uploaded */
          }
          setState((s) => ({ ...s, status: 'done', progress: 1, file: s.file && { ...s.file, fileId } }))
        } else if (req.status === 415 || req.status === 413) {
          // The server looked inside the file (or measured it) and can't take it: a different file is needed
          setState((s) => ({ ...s, status: 'error', progress: 0, error: req.status === 415 ? TYPE_ERROR : SIZE_ERROR, retryable: false }))
        } else setState((s) => ({ ...s, status: 'error', error: undefined, retryable: true }))
      }
      req.onerror = () => setState((s) => ({ ...s, status: 'error', error: undefined, retryable: true }))
      req.open('POST', endpoint + query)
      req.setRequestHeader('x-file-name', encodeURIComponent(file.name))
      if (meta.itemId) req.setRequestHeader('x-item-id', meta.itemId)
      if (meta.year) req.setRequestHeader('x-tax-year', String(meta.year))
      req.send(file)
    },
    [endpoint],
  )

  /** Try the last file again (without any test flags). */
  const retry = useCallback(() => last.current && start(last.current.file, '', last.current.meta), [start])

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
