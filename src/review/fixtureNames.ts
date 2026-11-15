// Names of Review's dev states (/review?review=…). No values here, so production
// builds can import this; the sample documents themselves (fixtures.ts) load only
// in development.
export const REVIEW_FIXTURES = ['needs', 'ticked', 'failed', 'wrongtype', 'replace', 'summary'] as const
export type ReviewFixture = (typeof REVIEW_FIXTURES)[number]
export const isReviewFixture = (s: string | null): s is ReviewFixture => REVIEW_FIXTURES.includes(s as ReviewFixture)

/** The sample return's documents, in Review order (identity first) */
export const FIXTURE_ITEMS = [
  { id: 'passport', form: 'Passport', files: ['passport.jpg'] },
  { id: 'i94', form: 'Most recent I-94', files: ['i94.pdf'] },
  { id: 'opt-cpt', form: 'W-2', files: ['w2.pdf'] },
]

/** Which screen each state opens on */
export const FIXTURE_START: Record<ReviewFixture, string> = { needs: 'passport', ticked: 'passport', failed: 'passport', wrongtype: 'opt-cpt', replace: 'opt-cpt', summary: 'summary' }

