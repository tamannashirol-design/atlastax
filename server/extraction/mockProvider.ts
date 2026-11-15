// The mock provider: fake, scripted results, so the whole flow can be built
// and tested before a real reading service is chosen. Its waits live HERE, in
// the fake backend; the browser never has a progress timer (D7).
//
// Scenarios (set from /motion in development; one per session):
//   normal        3 to 5 seconds per stage (reading, then checking), so it feels real
//   fast          every result within ~1s (automated checks only)
//   one-fails     the next document read can't be read; Try again works
//   wrong-type    the next document read isn't the expected form
//   blurry        the next document read is too blurry
//   rotated       the next document read is sideways
//   all-fail      every document fails, retries too
//   no-stages     the provider can't report stages (no "Checking")
//   low-confidence  results with several "Please check" and missing fields
//
// Every value below is FAKE (SSN-like values only from the allowed list).
import { setTimeout as wait } from 'node:timers/promises'
import { FAKE, NORMALLY_LOW } from './fakeValues.ts'
import type { ExtractedField, ExtractionProvider, Failure, ProviderEvent, ReadInput } from './provider.ts'

export const SCENARIOS = ['normal', 'fast', 'one-fails', 'wrong-type', 'blurry', 'rotated', 'all-fail', 'no-stages', 'low-confidence'] as const
export type Scenario = (typeof SCENARIOS)[number]
export const isScenario = (s: unknown): s is Scenario => SCENARIOS.includes(s as Scenario)

/** Scenarios that make the NEXT document read fail once (not its retry) */
const ONE_SHOT: Partial<Record<Scenario, Failure>> = { 'one-fails': 'unreadable', 'wrong-type': 'wrong-type', blurry: 'blurry', rotated: 'rotated' }

/** Milliseconds: queued → reading, reading → checking, checking → result. Normal stages take 3–5s each, at random. */
const between = (min: number, max: number) => min + Math.round(Math.random() * (max - min))
const timing = (scenario: Scenario): [number, number, number] =>
  scenario === 'fast' ? [100, 300, 200] : [300, between(3_000, 5_000), between(3_000, 5_000)]

export function mockProvider(scenarioFor: () => { scenario: Scenario; takeOneShot: () => boolean }): ExtractionProvider {
  return {
    name: 'mock',
    capabilities: () => ({ stages: scenarioFor().scenario !== 'no-stages' }),
    async *read(input: ReadInput): AsyncIterable<ProviderEvent> {
      const { scenario, takeOneShot } = scenarioFor()
      const [toReading, reading, checking] = timing(scenario)
      const pause = (ms: number) => wait(ms, undefined, { signal: input.signal })

      await pause(toReading)
      yield { type: 'stage', stage: 'reading' }

      const oneShot = ONE_SHOT[scenario]
      if (scenario === 'all-fail' || (oneShot && input.trigger === 'start' && takeOneShot())) {
        await pause(reading)
        yield { type: 'failed', reason: scenario === 'all-fail' ? 'unreadable' : oneShot! }
        return
      }

      if (scenario === 'no-stages') {
        await pause(reading + checking)
      } else {
        await pause(reading)
        yield { type: 'stage', stage: 'checking' }
        await pause(checking)
      }

      const form = input.forms[0]
      const values = FAKE[form]
      const fields: ExtractedField[] = input.fieldsFor(form).map((spec, i) => {
        const suggested = values[spec.key] ?? null
        const low = scenario === 'low-confidence' ? i % 2 === 1 : NORMALLY_LOW.has(spec.key)
        return {
          key: spec.key,
          label: spec.label,
          box: spec.box,
          kind: spec.kind,
          sensitive: spec.sensitive,
          needsTick: spec.needsTick,
          suggested: scenario === 'low-confidence' && i % 4 === 3 ? null : suggested,
          confidence: suggested === null || (scenario === 'low-confidence' && i % 4 === 3) ? 'missing' : low ? 'low' : 'high',
          value: null,
          source: 'suggested',
        }
      })
      yield { type: 'result', form, fields }
    },
  }
}
