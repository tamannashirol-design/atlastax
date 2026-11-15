// Names of /result's test states (/result?result=…, linked from /motion). No numbers
// here, so production builds can import this; the sample estimates themselves
// (fixtures.ts) load only in development.
export const RESULT_FIXTURES = ['refund', 'owed', 'blocked', 'waiting'] as const
export type ResultFixture = (typeof RESULT_FIXTURES)[number]
export const isResultFixture = (s: string | null): s is ResultFixture => RESULT_FIXTURES.includes(s as ResultFixture)
