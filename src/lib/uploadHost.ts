// Whoever opens an upload (a sheet, or a section of a page) tells the upload
// control how to close it, so "Not now" on the consent sheet can leave cleanly.
import { createContext, useContext } from 'react'

export const UploadHostContext = createContext<{ close: () => void } | null>(null)
export const useUploadHost = () => useContext(UploadHostContext)
