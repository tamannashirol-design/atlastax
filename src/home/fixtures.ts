// Testing only: ?home=new|progress|documents|ready|notsupported shows Home with these
// answers instead of the saved ones (nothing is saved). Generic data.
import type { Answers } from '../flow/answers'

const aboutAndTime: Answers = { visa: 'F-1', enrolled: 'yes', state: 'CA', citizenship: 'IN', residency: { arrivalYear: 2023, left: 'no' } }

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
  ready: { ...questionsDone, details: { ...questionsDone.details, 'i94-upload': ['I-94.pdf'], 'passport-upload': ['Passport.pdf'], 'self-report:freelance': 'later' } },
}

export function homeFixture(): Answers | null {
  const key = new URLSearchParams(window.location.search).get('home')
  return key && key in HOME_FIXTURES ? HOME_FIXTURES[key] : null
}
