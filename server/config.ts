// Server settings. Change values here only.
import { join } from 'node:path'
import { CONSENT_VERSION } from '../src/consent.config.ts'
import { MAX_UPLOAD_BYTES } from '../src/config.ts'

export type ServerOptions = {
  /** Where uploaded files and small records are kept. Git-ignored. */
  dataDir: string
  /** Largest file accepted, in bytes (shared with the browser: src/config.ts) */
  maxFileBytes: number
  /**
   * Refuse stored uploads until consent is recorded for the current notice
   * version (EXTRACTION-PLAN.md §4). On since build step 4 (the consent sheet).
   * Measured-only dev uploads (?dry=1, nothing stored) never need it.
   */
  consentRequired: boolean
  /** The privacy notice version people agree to: src/consent.config.ts (bump it when the words change; everyone is asked again). */
  consentVersion: string
  /**
   * Development only: slows uploads down so the folder animation shows real
   * progress on a fast local connection, and allows the test switches
   * (?fail=1, ?kbps=300, ?dry=1). Never on in production.
   */
  dev: boolean
}

export const DEFAULT_OPTIONS: ServerOptions = {
  dataDir: join(process.cwd(), '.data'),
  maxFileBytes: MAX_UPLOAD_BYTES,
  consentRequired: true,
  consentVersion: CONSENT_VERSION,
  dev: false,
}

/** Dev throttle: bytes per second read from an upload (the animation was tuned to this). */
export const DEV_UPLOAD_KBPS = 600
/** Dev pause before answering, the "finishing" moment of the upload animation. */
export const DEV_FINISH_MS = 400
