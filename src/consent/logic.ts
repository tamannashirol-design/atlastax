// The consent decisions, as small pure functions (tested by `npm run check:consent`).
// No React, no network: src/consent/client.ts holds the state and calls these.

export type ConsentStatus = 'unknown' | 'loading' | 'ready' | 'error'

export type ConsentState = {
  status: ConsentStatus
  /** The server asks for consent before storing files */
  required: boolean
  /** This session agreed to the CURRENT notice version */
  given: boolean
  version: string
  /** When they agreed (ISO), for the Profile line */
  at?: string
}

export const INITIAL_CONSENT: ConsentState = { status: 'unknown', required: true, given: false, version: '' }

/** True while we don't know the answer yet (nothing may be stored meanwhile). */
export const consentPending = (s: ConsentState) => s.status === 'unknown' || s.status === 'loading'

/** The sheet must be shown: we know consent is required and not given. */
export const consentNeeded = (s: ConsentState) => s.status === 'ready' && s.required && !s.given

/**
 * Stored uploads wait while consent is pending or needed. If the server can't be
 * reached (status "error") they are NOT held back: the upload itself will fail and
 * say so, which is better than a consent sheet that can never be saved.
 */
export const uploadsBlocked = (s: ConsentState) => consentPending(s) || consentNeeded(s)

/** What the server said, as a ready state. A missing field means "not given". */
export function fromServer(body: { given?: boolean; version?: string; required?: boolean; at?: string }): ConsentState {
  return { status: 'ready', required: body.required !== false, given: body.given === true, version: body.version ?? '', ...(body.given && body.at ? { at: body.at } : {}) }
}

/** After agreeing: given, with the time. */
export const afterAgree = (s: ConsentState, at: string): ConsentState => ({ ...s, status: 'ready', given: true, at })

/** The server refused an upload for lack of consent (the version changed, or the cookie was lost): ask again. */
export const afterRefusal = (s: ConsentState): ConsentState => ({ ...s, status: 'ready', required: true, given: false, at: undefined })
