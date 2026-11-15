// Consent in the browser (EXTRACTION-PLAN.md §4). The server is the record: this
// only caches what it said, and agrees by POSTing the notice version the person saw.
// Decisions live in ./logic.ts.
import { useEffect, useSyncExternalStore } from 'react'
import { afterAgree, afterRefusal, fromServer, INITIAL_CONSENT, type ConsentState } from './logic.ts'

let state: ConsentState = INITIAL_CONSENT
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null

function set(next: ConsentState) {
  state = next
  listeners.forEach((l) => l())
}

/** Ask the server once (and again when forced). Safe to call from many places. */
export function loadConsent(force = false): Promise<void> {
  if (!force && (state.status === 'ready' || loading)) return loading ?? Promise.resolve()
  if (state.status !== 'ready') set({ ...state, status: 'loading' })
  loading = fetch('/api/consent')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('consent'))))
    .then((body) => set(fromServer(body)))
    .catch(() => set({ ...state, status: 'error' }))
    .finally(() => {
      loading = null
    })
  return loading
}

/** Agree to the current notice. Resolves true when the server recorded it. */
export async function giveConsent(): Promise<boolean> {
  try {
    if (!state.version) await loadConsent(true)
    const r = await fetch('/api/consent', { method: 'POST', body: JSON.stringify({ version: state.version }) })
    if (!r.ok) return false
    set(afterAgree(state, new Date().toISOString()))
    return true
  } catch {
    return false
  }
}

/** An upload was refused for lack of consent: forget what we cached, so the sheet shows again. */
export function consentRefused() {
  set(afterRefusal(state))
}

/** The current state, without React (tests, and code outside components). */
export const consentLoaded = (): ConsentState => state

export function useConsent(): ConsentState {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
  useEffect(() => {
    void loadConsent()
  }, [])
  return s
}
