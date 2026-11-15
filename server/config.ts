// Server settings. Change values here only.
import { join } from 'node:path'
import { MAX_UPLOAD_BYTES } from '../src/config.ts'

export type ServerOptions = {
  /** Where uploaded files and small records are kept. Git-ignored. */
  dataDir: string
  /** Largest file accepted, in bytes (shared with the browser: src/config.ts) */
  maxFileBytes: number
  /**
   * Refuse uploads until consent is recorded (EXTRACTION-PLAN.md §4).
   * Off until the consent sheet exists (build step 4), so uploads keep working.
   */
  consentRequired: boolean
  /** The privacy notice version people agree to. Bump it when the notice changes: everyone sees it again. TODO confirm with legal. */
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
  consentRequired: false,
  consentVersion: 'draft-1',
  dev: false,
}

/** Dev throttle: bytes per second read from an upload (the animation was tuned to this). */
export const DEV_UPLOAD_KBPS = 600
/** Dev pause before answering, the "finishing" moment of the upload animation. */
export const DEV_FINISH_MS = 400
