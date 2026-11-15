// Consent in the browser (EXTRACTION-PLAN.md §4). The server is the record and the
// source of the notice's words: this only caches what it said. Agreeing sends back
// the version and fingerprint of the notice that was on screen, never anything
// else, so the server can't record agreement to words that weren't shown.
// Decisions live in ./logic.ts.
import { useEffect, useSyncExternalStore } from 'react'
import { afterAgree, afterNoticeChanged, afterRefusal, fromServer, INITIAL_CONSENT, isNotice, type ConsentState } from './logic.ts'

let state: ConsentState = INITIAL_CONSENT
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null

function set(next: ConsentState) {
  state = next
  listeners.forEach((l) => l())
}

/**
 * Ask the server (once, or again when forced: "Try again", or after a failed
 * upload). One request at a time. While re-checking after an error the state
 * stays "error", so the message doesn't flicker.
 */
export function loadConsent(force = false): Promise<void> {
  if (loading) return loading
  if (!force && state.status === 'ready') return Promise.resolve()
  if (state.status === 'unknown') set({ ...state, status: 'loading' })
  loading = fetch('/api/consent')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('consent'))))
    .then((body) => set(fromServer(body)))
    .catch(() => set({ ...state, status: 'error' }))
    .finally(() => {
      loading = null
    })
  return loading
}

export type AgreeResult = 'agreed' | 'changed' | 'failed'

/**
 * Agree to the notice ON SCREEN. "changed": the server has a newer notice; its
 * words are now in the state (shown with "The notice has changed") and nothing
 * was recorded. "failed": nothing was recorded; the person can try again.
 */
export async function giveConsent(): Promise<AgreeResult> {
  const shown = state.notice
  if (!shown) return 'failed'
  try {
    const r = await fetch('/api/consent', { method: 'POST', body: JSON.stringify({ version: shown.version, fingerprint: shown.fingerprint }) })
    if (r.ok) {
      set(afterAgree(state, new Date().toISOString()))
      return 'agreed'
    }
    if (r.status === 409) {
      const body = (await r.json().catch(() => null)) as { notice?: unknown } | null
      if (isNotice(body?.notice)) {
        set(afterNoticeChanged(state, body.notice))
        return 'changed'
      }
    }
    return 'failed'
  } catch {
    return 'failed'
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
