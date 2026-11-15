// Testing only: ?home=new|progress|documents|ready|notsupported shows Home with these
// answers instead of the saved ones (nothing is saved). Generic data.
import type { ExtractionState } from '../extraction/client'
import type { Answers } from '../flow/answers'

const aboutAndTime: Answers = { visa: 'F-1', enrolled: 'yes', state: 'CA', citizenship: 'IN', residency: { arrivalYear: 2023, arrivalDate: '2023-08-15', left: 'no' } }

const questionsDone: Answers = {
  ...aboutAndTime,
  taxId: 'ssn',
  filedBefore: 'no',
  income: ['opt-cpt', 'scholarship', 'freelance'],
  details: { 'opt-type': 'opt', 'opt-w2': ['W-2 Example Employer.pdf'], 'scholarship-withheld': 'no', 'scholarship-1042s': 'later', 'freelance-form': 'no', 'freelance-amount': '1200' },
}

export const HOME_FIXTURES: Record<string, Answers> = {
  new: {},
  // Arrived 2019, no full year abroad: 2025 is past the first five calendar years
  notsupported: { visa: 'F-1', enrolled: 'yes', state: 'CA', citizenship: 'IN', residency: { arrivalYear: 2019, yearAbroad: 'no' } },
  progress: aboutAndTime,
  documents: questionsDone,
  // Same answers as "ready"; the reading status comes from READING_FIXTURES below
  readfailed: { ...questionsDone, details: { ...questionsDone.details, 'scholarship-1042s': ['1042-S.pdf'], 'i94-upload': ['I-94.pdf'], 'passport-upload': ['Passport.pdf'], 'self-report:freelance': 'provided' } },
  ready: { ...questionsDone, details: { ...questionsDone.details, 'scholarship-1042s': ['1042-S.pdf'], 'i94-upload': ['I-94.pdf'], 'passport-upload': ['Passport.pdf'], 'self-report:freelance': 'provided' } },
}

const doc = (itemId: string, status: 'ready' | 'failed') => ({ itemId, status, files: 1, ...(status === 'failed' ? { failure: 'blurry' as const } : {}) })
/** ?home=readfailed: a pretend reading status to go with the answers (nothing is saved) */
export const READING_FIXTURES: Record<string, ExtractionState> = {
  readfailed: { loaded: true, capabilities: { stages: true }, documents: { passport: doc('passport', 'failed'), i94: doc('i94', 'ready'), 'opt-cpt': doc('opt-cpt', 'ready'), scholarship: doc('scholarship', 'ready') } },
}

export function homeReadingFixture(): ExtractionState | null {
  const key = new URLSearchParams(window.location.search).get('home')
  return key && key in READING_FIXTURES ? READING_FIXTURES[key] : null
}

export function homeFixture(): Answers | null {
  const key = new URLSearchParams(window.location.search).get('home')
  return key && key in HOME_FIXTURES ? HOME_FIXTURES[key] : null
}
