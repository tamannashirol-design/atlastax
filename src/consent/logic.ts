// The consent decisions, as small pure functions (tested by `npm run check:consent`).
// No React, no network: src/consent/client.ts holds the state and calls these.
//
// Two rules everything here serves:
//   1. A stored upload is held unless the server has CONFIRMED agreement to the
//      current notice (or says none is needed). Not knowing yet, or not being able
//      to check, both hold it. No file bytes leave the browser before that.
//   2. Agreement is recorded only for the exact words the person was shown: the
//      sheet shows the notice the server sent, and agreeing echoes its version and
//      fingerprint. If the server has a newer notice, the new words are shown and
//      the person agrees afresh.

/** The notice's words, as sent by the server (same shape as CONSENT_COPY in src/consent.config.ts). */
export type NoticeCopy = {
  title: string
  lead: string
  rows: readonly { label: string; text: string }[]
  link: string
  linkHref: string
  accept: string
  decline: string
  close: string
}

/** A notice as shown on screen: its words plus the version and fingerprint that identify them. */
export type Notice = { version: string; fingerprint: string; copy: NoticeCopy }

export type ConsentStatus = 'unknown' | 'loading' | 'ready' | 'error'

export type ConsentState = {
  status: ConsentStatus
  /** The server asks for consent before storing files */
  required: boolean
  /** This session agreed to the CURRENT notice (version and words) */
  given: boolean
  /** The notice to show (from the server). Missing until loaded. */
  notice?: Notice
  /** The notice changed while it was on screen: say so above the new words */
  changed?: boolean
  /** When they agreed (ISO), for the Profile line */
  at?: string
}

export const INITIAL_CONSENT: ConsentState = { status: 'unknown', required: true, given: false }

/** True while we don't know the answer yet. */
export const consentPending = (s: ConsentState) => s.status === 'unknown' || s.status === 'loading'

/** We couldn't ask the server: say so, offer Try again, hold uploads. */
export const consentCheckFailed = (s: ConsentState) => s.status === 'error'

/** The sheet's words are known, consent is required, and not given. */
export const consentNeeded = (s: ConsentState) => s.status === 'ready' && s.required && !s.given && !!s.notice

/** Rule 1: a stored upload may go ONLY when the server confirmed agreement, or that none is needed. */
export const uploadsAllowed = (s: ConsentState) => s.status === 'ready' && (!s.required || s.given)
export const uploadsBlocked = (s: ConsentState) => !uploadsAllowed(s)

/** Is the consent sheet open for an upload control? "Not now" always wins until the person tries to upload again. */
export const consentSheetOpen = (s: ConsentState, o: { stores: boolean; declined: boolean }) => o.stores && consentNeeded(s) && !o.declined

export function isNotice(x: unknown): x is Notice {
  const n = x as Notice | null
  const c = n?.copy
  return (
    !!n &&
    typeof n.version === 'string' &&
    typeof n.fingerprint === 'string' &&
    !!c &&
    typeof c.title === 'string' &&
    typeof c.lead === 'string' &&
    Array.isArray(c.rows) &&
    c.rows.every((r) => typeof r?.label === 'string' && typeof r?.text === 'string') &&
    ['link', 'linkHref', 'accept', 'decline', 'close'].every((k) => typeof c[k as keyof NoticeCopy] === 'string')
  )
}

/**
 * What the server said, as a state. A missing "required" means required, a missing
 * "given" means not given (safe defaults). A required notice we can't read is an
 * error: we can't show words we don't have, so uploads stay held.
 */
export function fromServer(body: { given?: boolean; required?: boolean; at?: string; notice?: unknown }): ConsentState {
  const required = body.required !== false
  const notice = isNotice(body.notice) ? body.notice : undefined
  if (required && !notice) return { ...INITIAL_CONSENT, status: 'error' }
  const given = body.given === true
  return { status: 'ready', required, given, notice, ...(given && body.at ? { at: body.at } : {}) }
}

/** After agreeing: given, with the time; the "changed" note goes away. */
export const afterAgree = (s: ConsentState, at: string): ConsentState => ({ ...s, status: 'ready', given: true, changed: false, at })

/** The server has a newer notice than the one shown: show the new words, say they changed, ask afresh. */
export const afterNoticeChanged = (s: ConsentState, notice: Notice): ConsentState => ({ ...s, status: 'ready', required: true, given: false, notice, changed: true, at: undefined })

/** The server refused an upload for lack of consent (new notice, or a lost cookie): ask again. */
export const afterRefusal = (s: ConsentState): ConsentState => ({ ...s, status: 'ready', required: true, given: false, at: undefined })
