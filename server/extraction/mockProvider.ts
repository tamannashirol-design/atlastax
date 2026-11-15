// The mock provider: fake, scripted results, so the whole flow can be built
// and tested before a real reading service is chosen. Its waits live HERE, in
// the fake backend; the browser never has a progress timer (D7).
//
// Scenarios (set from /motion in development; one per session):
//   normal        a few seconds per document, with stages
//   fast          every result within ~1s (tests the Reading page's no-flash hold)
//   slow          over a minute (tests the 10s and 60s thresholds, background path)
//   one-fails     the next uploaded document can't be read; Try again works
//   wrong-type    the next uploaded document isn't the expected form
//   blurry        the next uploaded document is too blurry
//   rotated       the next uploaded document is sideways
//   all-fail      every document fails, retries too
//   no-stages     the provider can't report stages (no "Checking")
//   low-confidence  results with several "Please check" and missing fields
//
// Every value below is FAKE (SSN-like values only from the allowed list).
import { setTimeout as wait } from 'node:timers/promises'
import type { FormType } from '../../src/extraction.config.ts'
import type { ExtractedField, ExtractionProvider, Failure, ProviderEvent, ReadInput } from './provider.ts'

export const SCENARIOS = ['normal', 'fast', 'slow', 'one-fails', 'wrong-type', 'blurry', 'rotated', 'all-fail', 'no-stages', 'low-confidence'] as const
export type Scenario = (typeof SCENARIOS)[number]
export const isScenario = (s: unknown): s is Scenario => SCENARIOS.includes(s as Scenario)

/** Scenarios that make the NEXT uploaded document fail once */
const ONE_SHOT: Partial<Record<Scenario, Failure>> = { 'one-fails': 'unreadable', 'wrong-type': 'wrong-type', blurry: 'blurry', rotated: 'rotated' }

/** Milliseconds: queued → reading, reading → checking, checking → result */
const TIMING: Record<'normal' | 'fast' | 'slow', [number, number, number]> = {
  normal: [300, 2500, 1200],
  fast: [100, 300, 200],
  slow: [500, 62_000, 8_000],
}

// Fake values per form, keyed by field (src/extraction.config.ts). null = not on the form.
const FAKE: Record<FormType, Record<string, string | null>> = {
  'W-2': { employeeTaxId: '123-45-6789', employerName: 'Sample Employer Inc.', employerEin: '12-3456789', wages: '24180.00', federalWithheld: '2016.00', state: 'NY', stateWages: '24180.00', stateWithheld: null },
  '1042-S': { withholdingAgent: 'Sample University', incomeCode: '16', grossIncome: '12000.00', exemptionCode: '04', taxRate: '00.00', federalWithheld: '0.00', recipientCountry: 'Sample Country' },
  '1099-INT': { payerName: 'Sample Bank', interest: '42.17', federalWithheld: '0.00' },
  '1099-NEC': { payerName: 'Sample Client LLC', payerTin: '98-7654321', compensation: '3500.00', federalWithheld: '0.00' },
  '1099-DIV': { payerName: 'Sample Brokerage', ordinaryDividends: '118.40', federalWithheld: '17.76' },
  '1099-B': { payerName: 'Sample Brokerage', proceeds: '5200.00', costBasis: '4950.00', federalWithheld: '0.00' },
  Passport: { fullName: 'SAMPLE PERSON', passportNumber: 'X1234567', country: 'Sample Country', dateOfBirth: '2000-01-01', expires: '2031-01-01' },
  'I-94': { admissionNumber: '12345678901', classOfAdmission: 'F1', mostRecentEntry: '2025-08-15' },
}
/** In the normal results, these come back as "Please check" */
const NORMALLY_LOW = new Set(['federalWithheld', 'exemptionCode', 'expires'])

export function mockProvider(scenarioFor: () => { scenario: Scenario; takeOneShot: () => boolean }): ExtractionProvider {
  return {
    name: 'mock',
    capabilities: () => ({ stages: scenarioFor().scenario !== 'no-stages' }),
    async *read(input: ReadInput): AsyncIterable<ProviderEvent> {
      const { scenario, takeOneShot } = scenarioFor()
      const [toReading, reading, checking] = TIMING[scenario === 'fast' ? 'fast' : scenario === 'slow' ? 'slow' : 'normal']
      const pause = (ms: number) => wait(ms, undefined, { signal: input.signal })

      await pause(toReading)
      yield { type: 'stage', stage: 'reading' }

      const oneShot = ONE_SHOT[scenario]
      if (scenario === 'all-fail' || (oneShot && input.trigger === 'upload' && takeOneShot())) {
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
