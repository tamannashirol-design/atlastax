// Every simple question screen, in flow order. Copy comes from FLOW.md.
// All of them render through the same QuestionLayout (see FlowPage).
import type { ReactNode } from 'react'
import { AmountField, parseAmount } from '../components/AmountField'
import { IncomePicker } from '../components/IncomePicker'
import { SearchSelect } from '../components/SearchSelect'
import { SelectField } from '../components/SelectField'
import { TileGroup, type TileOption } from '../components/TileGroup'
import { UploadAnswer } from '../components/UploadAnswer'
import type { IncomeId } from '../data/income'
import { countries, usStates } from '../data/places'
import { TAX_YEAR } from '../config'
import { ARRIVAL_YEARS_BACK, OUT_OF_SCOPE } from '../residency.config'
import { requiredDayYears } from '../residency/days'
import { asksArrivalDate, asksIfStudent, asksYearAbroad, daysFor, inScope, isOutOfScope, isSupportedStudent } from '../residency/fromAnswers'
import { OtherWaysToFile } from '../residency/OtherWaysToFile'
import { schoolAnswered } from '../residency/school'
import { ArrivalDate, SchoolStep, TimeSummary, TripsStep, YearAbroad } from '../residency/TimeInUS'
import { setAnswers, setDetail, setResidency, type Answers } from './answers'
import { asksTaxHome } from './taxHome'
import { documentsDone, ruleForUploadScreen, uploadScreenApplies, type SkipValue } from './requiredDocuments'
import { at, sectionIndex, type FlowPosition, type SectionId } from './sections'

export type FlowScreen = {
  id: string
  path: string
  /** The stepper section; the step number and count are derived (positionOf) */
  section: SectionId
  /** Fixed text, or text that depends on earlier answers (OPT vs CPT) or the tax year being filed */
  question: string | ((a: Answers, year: number) => string)
  helper?: string
  helpLabel?: string
  isAnswered: (a: Answers, year: number) => boolean
  /** Show this screen only when this returns true (income follow-ups, residency steps). */
  when?: (a: Answers, year: number) => boolean
  /** Link under Continue that skips the question: "I'll add it later" (value "later")
   *  Every income upload uses "I'll add it later"; "I don't have this" (value
   *  "none") is reported on the Documents page. Both count as deferred. */
  skip?: { label: string; value: SkipValue }
  /** The answer control; must fit the fixed answer area unless answerArea is "auto". */
  answers: (a: Answers, labelledBy: string, year: number) => ReactNode
  answerArea?: 'fixed' | 'auto'
  /** Card grid: 8 columns wide at 1024px+ (see QuestionLayout). */
  wide?: boolean
  /** A stop screen: the primary button goes back to fix answers instead of continuing (e.g. the scope gate). */
  stop?: { label: string; href: string }
  /**
   * Shown as a slide-up sheet over the page before it (the income uploads),
   * like the previous-return sheet. Its address still works: opening it shows
   * that page with the sheet open. Sheets aren't counted as stepper steps.
   */
  sheet?: boolean
}

// ---------- Income follow-ups (proposal in FLOW.md, approved) ----------
// One question per screen, in income-card order. Screens appear only for the
// income types selected, and branch on earlier answers. Items marked
// "(tax review)" in FLOW.md are intentionally not built yet.

const INCOME: SectionId = 'income'
type When = (a: Answers) => boolean
const has = (id: IncomeId): When => (a) => !!a.income?.includes(id)
const answered = (screen: string, v: string): When => (a) => a.details?.[screen] === v
const and = (...w: When[]): When => (a) => w.every((f) => f(a))
const detail = (a: Answers, id: string) => a.details?.[id]

function tiles(id: string, question: string, options: TileOption<string>[], when: When, more: Partial<FlowScreen> = {}): FlowScreen {
  return {
    id,
    path: `/income/${id}`,
    section: INCOME,
    question,
    when,
    isAnswered: (a) => typeof detail(a, id) === 'string',
    answers: (a, labelledBy) => (
      <TileGroup labelledBy={labelledBy} value={detail(a, id) as string | undefined} onChange={(v) => setDetail(id, v)} options={options} />
    ),
    ...more,
  }
}

// Every upload question uses the same control (folder UploadZone + real upload),
// in a slide-up sheet over the question before it (see FlowPage).
// It appears only when documents.config.ts says its document is needed (no
// tax rule here): `id` is the rule's uploadScreen.
function upload(id: string, docLabel: string, question: FlowScreen['question'], helper: string, skip: FlowScreen['skip']): FlowScreen {
  ruleForUploadScreen(id) // fails loudly if the config has no rule for this screen
  return {
    id,
    path: `/income/${id}`,
    section: INCOME,
    question,
    helper,
    skip,
    when: (a) => uploadScreenApplies(id, a),
    sheet: true,
    isAnswered: (a) => Array.isArray(detail(a, id)) && (detail(a, id) as string[]).length > 0,
    answers: (a) => {
      const v = detail(a, id)
      const files = Array.isArray(v) ? v : []
      return (
        <UploadAnswer
          key={id}
          docLabel={docLabel}
          uploaded={files}
          allowAnother
          upload={{ key: id, itemId: ruleForUploadScreen(id).id }}
          onUploaded={(name) => setDetail(id, [...files, name])}
          onRemove={(i) => setDetail(id, files.filter((_, j) => j !== i))}
        />
      )
    },
  }
}

function amount(id: string, question: FlowScreen['question'], helper: string, when: When): FlowScreen {
  return {
    id,
    path: `/income/${id}`,
    section: INCOME,
    question,
    helper,
    when,
    isAnswered: (a) => parseAmount(detail(a, id) as string | undefined) > 0,
    answers: (a, labelledBy) => (
      <AmountField labelledBy={labelledBy} value={(detail(a, id) as string | undefined) ?? ''} onChange={(v) => setDetail(id, v)} />
    ),
  }
}

const yesNo: TileOption<string>[] = [
  { value: 'yes', code: 'Yes' },
  { value: 'no', code: 'No' },
]
const LATER: FlowScreen['skip'] = { label: "I'll add it later", value: 'later' }

function incomeFollowUps(): FlowScreen[] {
  // Freelance and contract work ask the same things
  const selfEmployed = (key: 'freelance' | 'contract-work', name: string, short: string) => [
    tiles(`${short}-form`, `Did you get a 1099-NEC for your ${name}?`, yesNo, has(key), { helper: 'If you did, we’ll read the amounts from it' }),
    upload(`${short}-1099`, '1099-NEC', `Upload your 1099-NEC forms for ${name}`, 'From your clients. One per client', LATER),
    amount(`${short}-amount`, (_, year) => `How much were you paid for ${name} in ${year}?`, 'Add up what every client paid you', and(has(key), answered(`${short}-form`, 'no'))),
  ]
  return [
    // Bank interest
    tiles('bank-form', 'Did you get a tax form for your bank interest?', yesNo, has('bank-interest'), { helper: 'If you did, we’ll read the amounts from it' }),
    upload('bank-upload', 'bank form', 'Upload your bank interest form', 'From your bank, if they sent one', LATER),
    amount('bank-amount', (_, year) => `How much bank interest did you earn in ${year}?`, 'Check your bank statements for the year', and(has('bank-interest'), answered('bank-form', 'no'))),
    // OPT or CPT
    tiles(
      'opt-type',
      'Was this work OPT, CPT, or both?',
      [
        { value: 'opt', code: 'OPT' },
        { value: 'cpt', code: 'CPT' },
        { value: 'both', code: 'Both' },
      ],
      has('opt-cpt'),
      { helper: 'So we can label your job correctly' },
    ),
    // Neutral copy: the W-2 comes from the employer, whatever the work authorization
    upload('opt-w2', 'W-2', 'Upload your W-2', 'From your employer. One per employer', LATER),
    // On-campus job
    upload('campus-w2', 'W-2', 'Upload your W-2 from your on-campus job', 'From your university’s payroll office. One per job', LATER),
    // Scholarship (the "costs other than tuition" question waits for tax review)
    tiles('scholarship-withheld', 'Did your university withhold tax from your scholarship?', yesNo, has('scholarship'), {
      helper: 'To check refund eligibility',
      helpLabel: 'Not sure whether tax was withheld?',
    }),
    upload('scholarship-1042s', '1042-S', 'Upload your 1042-S for your scholarship', 'From your university', LATER),
    // Only the part used for things other than tuition, fees and required books is taxed (Pub 519 (2025), pages 24–25;
    // Instructions for Form 1040-NR (2025), page 31, line 8r). Rules: src/tax/federal.ts, years/income-2025.ts.
    tiles(
      'scholarship-paid-for',
      'What did your scholarship pay for?',
      [
        { value: 'tuition', code: 'Tuition' },
        { value: 'living', code: 'Living costs' },
        { value: 'both', code: 'Both' },
      ],
      has('scholarship'),
      // No tile descriptions: three tiles with them overflow the answer area on a phone (like "OPT, CPT, or both")
      { helper: 'Tuition includes fees and required books' },
    ),
    amount('scholarship-stipend', (_, year) => `How much of it was for living costs in ${year}?`, 'Rent, food or travel. Check your award letter', and(has('scholarship'), answered('scholarship-paid-for', 'both'))),
    // Freelance (expenses wait for tax review)
    ...selfEmployed('freelance', 'freelance work', 'freelance'),
    // Investments
    upload('investments-upload', 'tax form', 'Upload your investment tax forms', `From your brokerage or bank, such as a ${ruleForUploadScreen('investments-upload').form}`, LATER),
    // Trading
    upload('trading-upload', 'tax form', 'Upload your brokerage tax forms', `Such as a ${ruleForUploadScreen('trading-upload').form}`, LATER),
    // Trading gains are taxed (at 30%) only with 183 days or more in the U.S., and only if the gain is from U.S. sources,
    // which for stock depends on the tax home (Pub 519 (2025), pages 20 and 32). So: asked only with trading income AND 183+ days.
    // TODO confirm with CPA: "main home" stands in for the tax home (the main place of work, or where you regularly live).
    {
      ...tiles(
        'trading-tax-home',
        'Where was your main home?',
        [
          { value: 'us', code: 'In the U.S.' },
          { value: 'home', code: 'Home country' },
        ],
        has('trading'),
        { helper: 'Where you mainly worked or lived' },
      ),
      // Designer's wording "…was your main home in the U.S. or in your home country?" is 4 lines on a phone (3 from 600px), over the
      // layout limit (3, then 2), so the two options moved to the tiles
      question: (_, year) => `In ${year}, where was your main home?`,
      when: (a, year) => asksTaxHome(a, year),
    },
    // Contract work (expenses wait for tax review)
    ...selfEmployed('contract-work', 'contract work', 'contract'),
    // No earnings: nothing to ask. Donation and Child care: on hold for tax review.
  ]
}

// Non-breaking hyphens (‑) keep words like "visa‑relevant" on one line.
export const flow: FlowScreen[] = [
  {
    id: 'visa',
    path: '/visa',
    section: 'about',
    question: 'What is your visa type?',
    helper: 'To personalize the experience and show only visa‑relevant forms',
    helpLabel: 'Not sure about your visa type?',
    isAnswered: (a) => !!a.visa,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.visa}
        onChange={(visa) => setAnswers({ visa })}
        options={[
          { value: 'F-1', code: 'F-1', description: 'Academic' },
          { value: 'J-1', code: 'J-1', description: 'Exchange' },
          { value: 'M-1', code: 'M-1', description: 'Vocational' },
        ]}
      />
    ),
  },
  {
    // J-1 only. Students only for now: "No" shows "We don't support this yet" (FlowPage)
    id: 'j1-student',
    path: '/j1-student',
    section: 'about',
    question: 'Are you in the U.S. as a student?',
    helper: 'AtlasTax supports students for now',
    when: (a) => asksIfStudent(a),
    isAnswered: (a) => !!a.residency?.j1Student,
    answers: (a, id) => (
      <TileGroup labelledBy={id} value={a.residency?.j1Student} onChange={(j1Student) => setResidency({ j1Student: j1Student as 'yes' | 'no' })} options={yesNo} />
    ),
  },
  {
    // Added by the designer; helper wording to confirm with a tax professional (FLOW.md)
    id: 'enrolled',
    path: '/enrolled',
    section: 'about',
    question: 'Are you currently enrolled at a U.S. university or college?',
    helper: 'To check your student status for the right forms',
    isAnswered: (a) => !!a.enrolled,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.enrolled}
        onChange={(enrolled) => setAnswers({ enrolled })}
        options={[
          { value: 'yes', code: 'Yes' },
          { value: 'no', code: 'No' },
        ]}
      />
    ),
  },
  {
    id: 'state',
    path: '/state',
    section: 'about',
    question: 'What U.S. state do you currently live or study in?',
    helper: 'To identify if a state tax return is required',
    isAnswered: (a) => !!a.state,
    answers: (a, id) => (
      <SelectField labelledBy={id} options={usStates} value={a.state} onChange={(state) => setAnswers({ state })} placeholder="Choose a state" />
    ),
  },
  {
    id: 'citizenship',
    path: '/citizenship',
    section: 'about',
    question: 'What is your country of citizenship?',
    helper: 'To automatically check tax‑treaty eligibility',
    helpLabel: 'What is a tax‑treaty?',
    isAnswered: (a) => !!a.citizenship,
    answers: (a, id) => (
      <SearchSelect
        labelledBy={id}
        options={countries()}
        value={a.citizenship}
        onChange={(citizenship) => setAnswers({ citizenship })}
        placeholder="Search countries"
      />
    ),
  },
  {
    // Tax treaties go by where you lived (were a resident) before coming, not by citizenship (Pub 901: "a resident of India
    // immediately before visiting"; China: "a resident … on the date of arrival"). The student treaty rule reads this.
    id: 'lived-before',
    path: '/lived-before',
    section: 'about',
    question: 'Where did you live before coming to the U.S.?',
    helper: 'Some tax treaties depend on where you lived, not your citizenship',
    isAnswered: (a) => !!a.livedBefore,
    answers: (a, id) => (
      <SearchSelect labelledBy={id} options={countries()} value={a.livedBefore} onChange={(livedBefore) => setAnswers({ livedBefore })} placeholder="Search countries" />
    ),
  },
  {
    // Filing status depends on marital status at the end of the year. Married: no estimate number yet (src/tax/stops.ts).
    id: 'marital',
    path: '/marital',
    section: 'about',
    question: (_, year) => `What was your marital status at the end of ${year}?`,
    helper: 'Your filing status depends on it',
    isAnswered: (a) => !!a.marital,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.marital}
        onChange={(marital) => setAnswers({ marital: marital as 'single' | 'married' })}
        options={[
          { value: 'single', code: 'Single', description: 'Including divorced or widowed' },
          { value: 'married', code: 'Married', description: 'Even if your spouse lives abroad' },
        ]}
      />
    ),
  },
  // ---------- Time in the U.S. (rules: residency.config.ts; working: src/residency) ----------
  {
    id: 'arrival-year',
    path: '/arrival-year',
    section: 'time',
    question: 'What year did you first arrive in the U.S. as a student?',
    helper: 'Your first years as a student are counted differently',
    when: (a) => isSupportedStudent(a),
    isAnswered: (a) => !!a.residency?.arrivalYear,
    answers: (a, id, year) => (
      <SelectField
        labelledBy={id}
        options={Array.from({ length: ARRIVAL_YEARS_BACK + 1 }, (_, i) => String(year - i)).map((y) => ({ value: y, label: y }))}
        value={a.residency?.arrivalYear ? String(a.residency.arrivalYear) : undefined}
        onChange={(v) => setResidency({ arrivalYear: Number(v) })}
        placeholder="Choose a year"
      />
    ),
  },
  {
    // Only when arrival → tax year spans more than the student limit (otherwise the answer can't change anything)
    id: 'year-abroad',
    path: '/year-abroad',
    section: 'time',
    // Shortened from "Was there a full calendar year when you weren't in the U.S. at all?" to fit 3 lines on a phone (2 from 600px)
    question: 'Did you spend a full calendar year outside the U.S.?',
    helper: 'A full year away isn’t counted as one of your student years',
    when: (a, year) => isSupportedStudent(a) && asksYearAbroad(a, year),
    isAnswered: (a) => a.residency?.yearAbroad === 'no' || (a.residency?.yearAbroad === 'yes' && (a.residency.abroadYears?.length ?? 0) > 0),
    answerArea: 'auto',
    answers: (_a, id, year) => <YearAbroad labelledBy={id} taxYear={year} />,
  },
  {
    // v1 SCOPE GATE (residency.config.ts): outside the first 5 calendar years as a student, the flow stops here.
    // Every screen after this one is hidden for out-of-scope answers (see gateAfterStop below).
    id: 'not-supported',
    path: '/not-supported',
    section: 'time',
    question: OUT_OF_SCOPE.headline,
    when: (a, year) => isOutOfScope(a, year),
    isAnswered: () => true,
    answerArea: 'auto',
    stop: { label: 'Check my answers', href: '/arrival-year' },
    answers: (_a, id) => (
      <div className="flex flex-col gap-6">
        <p className="text-body">{OUT_OF_SCOPE.body}</p>
        <section aria-labelledby={`${id}-other`} className="flex flex-col gap-3">
          <h2 id={`${id}-other`} className="text-body font-semibold">
            Other ways to file
          </h2>
          <OtherWaysToFile />
        </section>
      </div>
    ),
  },
  {
    // Only when the arrival year is one Form 8843 asks days for
    id: 'arrival-date',
    path: '/arrival-date',
    section: 'time',
    question: 'What date did you arrive?',
    helper: 'To count your days in the U.S. that year',
    when: (a, year) => isSupportedStudent(a) && inScope(a, year) === true && asksArrivalDate(a, year),
    isAnswered: (a) => !!a.residency?.arrivalDate?.startsWith(String(a.residency.arrivalYear)),
    answers: (a, id) => <ArrivalDate labelledBy={id} year={a.residency!.arrivalYear!} value={a.residency?.arrivalDate ?? ''} onChange={(arrivalDate: string) => setResidency({ arrivalDate })} />,
  },
  {
    id: 'trips',
    path: '/trips',
    section: 'time',
    question: (a, year) => `Did you leave the U.S. in ${listYears(requiredDayYears(year, a.residency?.arrivalYear ?? year))}?`,
    helper: 'To count your days in the U.S. for Form 8843',
    // Part of the section unless the answers are outside scope (travel days are only asked within scope)
    when: (a, year) => isSupportedStudent(a) && inScope(a, year) !== false,
    isAnswered: (a, year) => !!daysFor(a, year)?.complete,
    answerArea: 'auto',
    answers: (_a, id, year) => <TripsStep labelledBy={id} taxYear={year} />,
  },
  {
    // Form 8843 lines 9 and 10 (the school and the program director): typed, or filled in from an I-20 / DS-2019 (TODO confirm with CPA)
    id: 'school',
    path: '/school',
    section: 'time',
    question: 'Tell us about your school',
    helper: 'For Form 8843. From your I-20 or DS-2019',
    when: (a, year) => isSupportedStudent(a) && inScope(a, year) !== false,
    isAnswered: (a) => schoolAnswered(a.residency?.school, a.residency?.director) || a.details?.school === 'later',
    skip: LATER,
    answerArea: 'auto',
    answers: (_a, id) => <SchoolStep labelledBy={id} />,
  },
  {
    // Form 8843 line 13. The last question in Time in the U.S. (TODO confirm with CPA what a Yes means for the return)
    id: 'green-card',
    path: '/green-card',
    section: 'time',
    question: (_a, year) => `In ${year}, did you apply for a green card?`,
    helper: 'Permanent residence. Form 8843 asks this',
    when: (a, year) => isSupportedStudent(a) && inScope(a, year) !== false,
    isAnswered: (a) => !!a.residency?.greenCard,
    answers: (a, id) => <TileGroup labelledBy={id} value={a.residency?.greenCard} onChange={(greenCard) => setResidency({ greenCard: greenCard as 'yes' | 'no' })} options={yesNo} />,
  },
  {
    id: 'time-summary',
    path: '/time-in-us',
    section: 'time',
    question: 'Check your time in the U.S.',
    helper: 'Change anything that doesn’t look right',
    // Part of the section unless the answers are outside scope (travel days are only asked within scope)
    when: (a, year) => isSupportedStudent(a) && inScope(a, year) !== false,
    isAnswered: () => true,
    answerArea: 'auto',
    answers: (_a, _id, year) => <TimeSummary taxYear={year} />,
  },
  // ---------- Tax details ----------
  {
    id: 'tax-id',
    path: '/tax-id',
    section: 'tax',
    question: 'Do you have a Social Security Number (SSN) or ITIN?',
    helper: 'To decide if you can e‑file or must paper file.',
    helpLabel: 'Not sure whether you have it?',
    isAnswered: (a) => !!a.taxId,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.taxId}
        onChange={(taxId) => setAnswers({ taxId })}
        options={[
          // No descriptions: "Social Security" wraps on a phone and overflows the
          // answer area, and the question already spells out both terms.
          { value: 'ssn', code: 'SSN' },
          { value: 'itin', code: 'ITIN' },
          { value: 'none', code: 'N/A' },
        ]}
      />
    ),
  },
  {
    id: 'filed-before',
    path: '/filed-before',
    section: 'tax',
    question: 'Have you filed U.S. taxes before?',
    helpLabel: 'Not sure whether you have filed before?',
    isAnswered: (a) => !!a.filedBefore,
    answers: (a, id) => (
      <TileGroup
        labelledBy={id}
        value={a.filedBefore}
        onChange={(filedBefore) => setAnswers({ filedBefore })}
        options={[
          { value: 'yes', code: 'Yes' },
          { value: 'no', code: 'No' },
        ]}
      />
    ),
  },
  // ---------- Income ----------
  {
    id: 'income',
    path: '/income',
    section: 'income',
    question: 'Select the ones that apply to you',
    isAnswered: (a) => (a.income?.length ?? 0) > 0,
    answerArea: 'auto',
    wide: true,
    answers: (a, id) => <IncomePicker labelledBy={id} value={a.income ?? []} onChange={(income) => setAnswers({ income })} />,
  },
  ...incomeFollowUps(),
  {
    // Form 1040-NR asks everyone this (page 1, "Digital Assets"). Yes: no estimate number yet (src/tax/stops.ts).
    id: 'digital-assets',
    path: '/digital-assets',
    section: 'income',
    // Asked as "…crypto, NFTs or other digital assets?"; that runs to 4 lines on a phone (3 from 600px), so crypto and NFTs
    // moved to the helper to keep the question within 3 lines (2 from 600px)
    question: (_, year) => `In ${year}, did you receive or sell digital assets?`,
    helper: 'Such as crypto or NFTs. Form 1040‑NR asks everyone this',
    isAnswered: (a) => !!a.digitalAssets,
    answers: (a, id) => <TileGroup labelledBy={id} value={a.digitalAssets} onChange={(digitalAssets) => setAnswers({ digitalAssets: digitalAssets as 'yes' | 'no' })} options={yesNo} />,
  },
]

// Out of scope: every screen after the stop screen is hidden, so Back/Continue,
// "Continue where you left off" and the stepper never lead past it.
const STOP_INDEX = flow.findIndex((s) => s.id === 'not-supported')
for (const screen of flow.slice(STOP_INDEX + 1)) {
  const own = screen.when
  screen.when = (a, year) => !isOutOfScope(a, year) && (!own || own(a, year))
}

/** Out of scope and asking for a page past the stop screen (a later question, Documents, Review)? */
export function isGatedPath(path: string, a: Answers, year = TAX_YEAR): boolean {
  if (!isOutOfScope(a, year)) return false
  const i = flow.findIndex((s) => s.path === path)
  return i > STOP_INDEX || path === AFTER_FLOW || path === REVIEW_PATH || path === READING_PATH || path === RESULT_PATH || path === EFILE_PATH || path === EFILE_DONE_PATH
}
export const STOP_PATH = '/not-supported'

/** Where Continue goes after the last question: the Documents page, opened "from the flow". */
export const AFTER_FLOW = '/documents'
export const REVIEW_PATH = '/review'
/** After Review's "Looks good": the estimate and downloads. The flow ends here. */
export const RESULT_PATH = '/result'
/** The E-file concept screen, from "Want to e-file instead?" on the result page */
export const EFILE_PATH = '/result/efile'
/** The celebration screen after choosing a card, bank or direct deposit on the E-file concept screen */
export const EFILE_DONE_PATH = '/result/efile/done'
/** After Documents → Continue. Skips straight to Review when nothing is still being read (EXTRACTION-PLAN.md, Reading page). Page built in step 5. */
export const READING_PATH = '/reading'

export const isFlowPath = (path: string) => flow.some((s) => s.path === path)

/** "2023, 2024 and 2025" */
export function listYears(years: number[]): string {
  return years.length <= 1 ? String(years[0] ?? '') : `${years.slice(0, -1).join(', ')} and ${years[years.length - 1]}`
}

/**
 * The stepper position of a screen: its section, and its step among the
 * screens of that section that apply to these answers. "x of n" and the
 * segments are always derived from this, never typed in.
 */
export function positionOf(screen: FlowScreen, a: Answers, year = TAX_YEAR): FlowPosition {
  const inSection = flow.filter((s) => s.section === screen.section && !s.sheet)
  const applying = inSection.filter((s) => s === screen || !s.when || s.when(a, year))
  return { section: sectionIndex(screen.section), step: Math.max(0, applying.indexOf(screen)), steps: applying.length }
}

/** First screen of a section that applies (for jumping from the stepper); Documents and Review are pages. */
export function pathForSection(section: number, a: Answers, year = TAX_YEAR): { path: string; state: Record<string, unknown> | null } {
  const screen = flow.find((s) => sectionIndex(s.section) === section && (!s.when || s.when(a, year)))
  if (screen) return { path: screen.path, state: null }
  return section === sectionIndex('documents') ? { path: AFTER_FLOW, state: { fromFlow: true } } : { path: REVIEW_PATH, state: null }
}

/** A question counts as done once answered, or skipped with its skip link. */
function screenDone(s: FlowScreen, a: Answers, year: number): boolean {
  return s.isAnswered(a, year) || (!!s.skip && detail(a, s.id) === s.skip.value)
}

/** The first question that applies and isn't done; everything done → the last one that applies. */
export function resumeScreen(a: Answers, year = TAX_YEAR): FlowScreen {
  const applies = flow.filter((s) => !s.when || s.when(a, year))
  return applies.find((s) => !screenDone(s, a, year)) ?? applies[applies.length - 1]
}

/**
 * Where "Continue where you left off" goes, and the stepper position there:
 * the first unfinished question; else the Documents page (from the flow)
 * until documentsDone(); else Review.
 */
export function resumeTarget(a: Answers, year = TAX_YEAR): { path: string; position: FlowPosition; state: Record<string, unknown> | null } {
  const unfinished = flow.filter((s) => !s.when || s.when(a, year)).find((s) => !screenDone(s, a, year))
  if (unfinished) return { path: unfinished.path, position: positionOf(unfinished, a, year), state: null }
  if (!documentsDone(a)) return { path: AFTER_FLOW, position: at('documents'), state: { fromFlow: true } }
  return { path: REVIEW_PATH, position: at('review'), state: null }
}
