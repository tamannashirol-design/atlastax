# After the documents: Review, estimate, forms

**Status: APPROVED (Nov 15, 2026), decisions in section 14. Build order in section 13; the
app's tax year is already switched to 2025.** This updates the
"After the documents" plan: the result screen now shows a **calculated federal
estimate** (prototype). It builds on `EXTRACTION-PLAN.md` (§5 Review screen, §6
changing files, D1–D9) and keeps its sequence, blocking rules, editing after Ready,
leaving and returning, motion and sensitive-data rules.

> **Heads-up:** the earlier "After the documents" text isn't in the project (no file,
> no commit). I rebuilt it from `EXTRACTION-PLAN.md` and the decisions in your brief.
> Where the old plan said something this one doesn't, tell me and I'll merge it.
> Also: step 3 of the extraction build is still **uncommitted** in your working folder.

---

## 0. Read this first: what I found

I read the IRS documents themselves (downloaded PDFs, converted to text), not search
summaries. One search summary gave a wrong number, which is why.

1. **There is no final 2026 Form 1040-NR yet.** Today is Nov 2026. The IRS has a
   *draft* 2026 form (posted Sept 2026, "should not be relied on") and **no 2026
   instructions**. The 2025 form and instructions are final. The 2026 tax tables and
   standard deduction *are* final (Rev. Proc. 2025-32). So the engine takes the tax
   year as a parameter, each year's config says `final` or `draft`, and I recommend
   we **build and verify 2025 first**, because every worked example exists for 2025.
   (Decided, section 14.)
2. **Most students get no standard deduction.** Nonresident aliens can't take it,
   except students from India under treaty Article 21(2). Everyone else uses itemized
   deductions, which for a typical student is just the state income tax taken out of
   their pay. So **W-2 box 17 (state tax withheld) matters** for the number.
3. **The IRS contradicts itself on the 2025 India standard deduction.** Rev. Proc.
   2025-32 §3.01 and Pub. 519's own Worksheet 5-1 say **$15,750**. A sentence on
   Pub. 519 page 58 still says $15,000. The engine uses $15,750 and flags the
   conflict for the CPA.
4. **A scholarship is taxed only for the part that isn't tuition, fees or required
   books.** It goes on Schedule 1 line 8r and is taxed at the ordinary rates (not a
   flat 14%; 14% is only the *withholding* on the 1042-S). The IRS gives two worked
   examples we can use as tests.
5. **My step-1 field list has a wrong box.** It says 1042-S "Federal tax withheld,
   Box 7a". The IRS instructions credit **Box 10** (line 25g). The other box numbers
   in `extraction.config.ts` were typed from memory in step 1 and are **unverified**.
   Fixing them is the first thing in step R1.
6. **Tax Table rounding matters.** Under $100,000 the tax comes from the IRS Tax
   Table, which uses the middle of each $50 band. My independent check reproduced two
   IRS results to the dollar this way (section 11).
7. **A student with no income may still have to file Form 1040-NR.** The 2025
   instructions (Table A) say a nonresident alien engaged in a U.S. trade or business
   must file even with no income. So "no earnings → Form 8843 only" is flagged
   "needs review", not assumed.
8. **This reverses a rule in CLAUDE.md.** It says "Copy: no promises (refunds…), no
   invented numbers", and the Home brief says "no refund estimates". A calculated
   estimate on the result screen needs a deliberate, narrow exception (section 12).

---

## 1. Sources: what each table comes from, and what I could not verify

Every number in config carries its source in a comment, and the breakdown screen can
show it. **Nothing below was typed from memory.**

| What | Source | Status |
|---|---|---|
| 2026 tax brackets, unmarried (Table 3) | Rev. Proc. 2025-32 §4.01 | **Verified** (seven rows read; each bracket's base tax checks out arithmetically). Text extraction scrambled table order, so a person should eyeball PDF p. 11. |
| 2026 standard deduction (India students only) $16,100 single | Rev. Proc. 2025-32 §4.14(1) | **Verified** |
| 2025 tax brackets, unmarried and married-filing-separately (Tables 3 and 4) | Rev. Proc. 2024-40 §3.01 (still in force for 2025) | **Verified** (arithmetic checks; reproduces the two IRS tax examples) |
| 2025 standard deduction $15,750 (India students only) | Rev. Proc. 2025-32 §3.01 and Pub. 519 (2025) Worksheet 5-1 | **Verified**, but conflicts with Pub. 519 p. 58 ($15,000). Flagged. |
| Form 1040-NR 2025 line structure (1a, 1k, 8, 9, 12, 15, 16, 24, 25a, 25g, 33, 34, 35a, 37, 38) | 2025 Form 1040-NR ("Created 9/8/25") | **Verified** |
| Who may take the standard deduction; itemized deductions for nonresidents; filing statuses (Single, Married filing separately, Qualifying surviving spouse only) | Pub. 519 (2025) ch. 5; 2025 Instructions for Form 1040-NR, "Exceptions" | **Verified** |
| Scholarship rules and examples (line 8r, 1k, 25g; Schedule OI item L) | 2025 Instructions for Form 1040-NR, "Line 8r" Examples 1 and 2 | **Verified** |
| Treaty wage example (France, $8,000 → 1a $3,000, 1k $5,000) | 2025 Instructions, "Line 1a" Examples 1 and 2 (Jean) | **Verified** |
| Tax Table example ($25,300 → $2,801) | 2025 Instructions p. 24, "Sample Table" (Shannon) | **Verified** |
| Single-filer example ($24,500 → $2,705, dividends $420 / $210) | Pub. 519 (2025), "Arthur Banks" example | **Verified** |
| Due dates: April 15 with wages subject to withholding; June 15 otherwise | 2025 Instructions, "When and Where Should You File?" | **Verified for 2025**; the 2026 year's dates come from its config |
| How to pay (Direct Pay, cards, check or money order on a U.S. bank, Form 1040-V, no-U.S.-bank page) | 2025 Instructions, "Line 37" and payments list | **Verified wording**, links to re-check at build time |
| Form 8843 fields (Parts I and III) | **2026** Form 8843 (the version I read) | Verified for 2026 only. **The 2025 form still has to be fetched and checked** (step R8). |

**Could not verify (each is a flag in config or a CPA item):**

1. **2026 Form 1040-NR line numbers.** Only a draft exists. The 2026 config reuses
   the 2025 line map, marked `draft`.
2. **The Tax Table rule itself.** The Form 1040 instructions (which hold the table)
   weren't fetched. I inferred the "middle of a $50 band" rule from two IRS results.
   Below $3,000 the bands are different and unverified. Step R4 tests **every row of
   the published table**.
3. **Tax from $100,000 up** (Tax Computation Worksheet). Not read; flagged, unlikely
   for students.
4. **The state-and-local-tax deduction limit.** Pub. 519 says $10,000 ($5,000 if
   married filing separately) for 2025. The 2025 law may have changed it for 2025.
   Unverified. Charitable limits also unverified.
5. **Bank interest, dividends, capital gains** (Schedule NEC). I saw the topics but
   not the rules in full. Income of these kinds is **not computed** (section 2).
6. **Treaty details** (Pub. 901 country tables). Not fetched. We never look up
   treaties.
7. **Schedule 1-A** (new 2025 deductions such as tips and overtime) and whether
   nonresidents can use them. Assumed none and said so on screen.
8. **Estimated-tax penalty and interest** (line 38). Not computed.
9. **Form 8843's own due date when filed alone**, and where to mail it.
10. **Whether payment is due April 15 even for the June 15 filers.** Unverified.
11. **Mailing addresses.** They live in config copied from the instructions for the
    year at build time. I haven't typed any.
12. **The 2025 instructions' status.** The PDF carries a print-proof "Draft" header
    dated 29 Jan 2026, and so does Pub. 519 (19 Feb 2026). Their numbers match the
    Rev. Procs. and Worksheet 5-1, but a person should confirm the final versions.

---

## 2. Scope: what the number includes, and what stops it

The estimate covers only what we can compute reliably from the confirmed values.
Anything else **blocks the number** (no partial number, which would read as a guess).

| Situation | Handling |
|---|---|
| W-2 wages (OPT, CPT, on-campus job) | **Computed** (line 1a), withholding credited (25a) |
| Scholarship that follows the plain pattern (1042-S income code is scholarship, 14% withheld, no exemption code) | **Computed**: Schedule 1 line 8r → line 8, withholding credited (25g) |
| Scholarship that is exempt by treaty, as shown on the 1042-S (exemption code present) | **Computed from what the form says**, tagged **advisory "needs review"** (Schedule OI item L, line 1k) |
| Scholarship with services (teaching or research), rate other than 14%, or any other pattern | **Blocks**: "needs review" |
| Citizen of India who is a student | **Computed with the India standard deduction** (greater of that or itemized), tagged advisory "needs review" |
| Freelance, contract work, investments, trading, bank interest, donation, child care | **Blocks** ("needs review"). Each has an entry in `INCOME_HANDLING` in config, so a CPA can move one to "computed" later. |
| Married, or any dependents | **Blocks** (credits, exemptions, and a different table column) |
| No earnings | No number. Outcome "Form 8843 only", tagged advisory "needs review" (Table A above) |
| Estimated-tax penalty, interest, credits, QBI, Schedule 1-A | Not computed. Stated in the assumptions list. |

Two kinds of "needs review":
- **Blocking**: we can't compute it. No number. The screen says why and what to do.
- **Advisory**: we computed it from exactly what the person (or their form) stated.
  The number shows with a visible "Needs review" tag on the affected lines and a
  line at the top: "A tax professional should check this before you rely on it."

We **never infer a treaty** from the person's country. We only apply what a 1042-S
states. (Decided, section 14.)

---

## 3. The calculation engine

### 3.1 Shape

A pure function. Same input, same output. No dates, no randomness, no network, no
files, no hard-coded results.

```ts
// src/tax/engine.ts
estimateReturn(input: TaxInput, year: number): Estimate
```

```
src/tax/
  years/2025.ts      tables, deductions, limits, due dates, line map, sources
  years/2026.ts      same shape; status: 'draft' until the IRS publishes the final form
  years/index.ts     config by year (an unknown year returns "not supported")
  input.ts           TaxInput type + buildTaxInput() (the transcription, section 4)
  engine.ts          estimateReturn() (pure)
  taxTable.ts        the Tax Table method (midpoint rule) and the schedule method
  review.ts          every "needs review" reason, blocking or advisory
  lines.ts           labels and plain-word descriptions of each form line
```

`TaxInput` (money in whole cents, converted from the confirmed text values):

```ts
{
  year, filingStatus: 'single' | 'mfs',
  person: { citizenship, visa, enrolledAsStudent },
  wages:       [{ employer, box1, box2, stateCode, box17 }],
  scholarships:[{ payer, box2, box10, incomeCode, exemptionCode, taxRate }],
  incomeTypesPresent: IncomeId[],          // decides blocks
  maritalStatus, dependents,               // new questions (section 5)
}
```

`Estimate`:

```ts
{
  year, yearStatus: 'final' | 'draft',
  outcome: 'refund' | 'owed' | 'zero' | 'form-8843-only' | 'blocked',
  amount: number | null,                   // whole dollars; null unless refund/owed/zero
  lines: [{ id: '1a', form: '1040-NR line 1a', label, amount, from: 'W-2, Sample Employer', review?: 'advisory' }],
  blockers: [{ reason, fix: { label, href } }],     // why there is no number
  reviewFlags: [{ reason, lines: ['8r'], kind: 'advisory' }],
  assumptions: string[],                   // "single", "no adjustments", "Tax Table method" ...
  sources: [{ table, citation }],          // which IRS figures were used
}
```

### 3.2 What it computes, in order (Form 1040-NR 2025 line numbers)

| Step | Line | How |
|---|---|---|
| Wages | 1a | sum of W-2 box 1 |
| Treaty-exempt income | 1k | memo line, **not** added to the total |
| Scholarship (taxable part) | Sch. 1 line 8r → **8** | 1042-S box 2, minus the treaty-exempt part |
| Total income | 9 | 1z + 8 |
| Adjustments | 10 | 0 (stated as an assumption) |
| Adjusted gross income | 11a / 11b | 9 − 10 |
| Deduction | 12 | itemized (state income tax withheld, box 17) **or** the India standard deduction (greater of the two) |
| Taxable income | 15 | max(0, 11b − 14) |
| Tax | 16 | Tax Table method below $100,000, schedule above; Single or Married-filing-separately column |
| Other taxes | 23a | 0 (any income that would need Schedule NEC blocks the number) |
| Total tax | 24 | 22 + 23d |
| Payments | 25a, 25g, 33 | W-2 box 2; 1042-S box 10; total |
| **Result** | 34 / 35a or 37 | refund if payments exceed tax, else amount owed |

All lines are whole dollars, rounded half up (the Shannon example shows this).

### 3.3 Where it runs and what the browser gets

On the **server**, next to the confirmed values (D3: nothing sensitive in the
browser). `POST /api/estimate?year=` returns the `Estimate` for the numbers only:
amounts and plain labels. It never returns ID numbers.

The browser stores **no amounts**: not in sessionStorage, not in localStorage, not
in logs. It keeps a status (`none | fresh | stale | blocked`) and a hash. If the
"hide the number" switch is off (section 7.5), the server doesn't send amounts at
all.

The same function runs in the test script (Node), so tests and the app can't drift.

### 3.4 Tax year handling (decided: 2025 first)

- **The app's tax year is now 2025** (`TAX_YEAR`), everywhere: Home, the intro, the
  stepper, sample file names, the Form 8843 day windows (2025, 2024, 2023).
  Earlier years offered on Home: **2024 and 2023** (2025 is no longer "earlier").
- `useFilingYear()` picks the config. An unsupported year (2024, 2023, and 2026
  until step R11) shows the same blocking "needs review" as an unsupported
  situation: "We can't estimate this tax year yet". Its questions still work.
- **2026 comes later** (step R11): `draft` until the IRS posts the final form and
  instructions; then the number carries a "Needs review" tag.
- **Heads-up:** the 2025 return was due **April 15, 2026** (June 15 for people with no
  wages withheld). Both dates have passed. Due dates come from the year's config, and
  the how-to-pay and result text must not say "due" as if it were upcoming.
  CPA/legal item: late filing, penalties and interest for a 2025 return.

---

## 4. Transcription: confirmed values → tax input (step R1)

"Transcription" here means turning the person's **confirmed** values and answers
into `TaxInput`, in one function (`buildTaxInput`) and nowhere else. Components never
read documents or answers to do tax logic (same rule as `requiredItems()`).

| Confirmed field (`extraction.config.ts`) | Goes to |
|---|---|
| W-2: Wages (Box 1) | wage line 1a |
| W-2: Federal tax withheld (Box 2) | line 25a |
| W-2: State (Box 15), State tax withheld (Box 17) | itemized deduction (Schedule A line 1a) |
| W-2: Employer, EIN, your SSN or ITIN | forms only (names and ID numbers, masked on screen) |
| 1042-S: Income code, Gross income, Exemption code, Tax rate | scholarship pattern check, line 8r or treaty line 1k |
| 1042-S: Federal tax withheld | **line 25g, from Box 10** (field list fixed in R1; today it says Box 7a) |
| Passport, I-94 | Form 8843 and the download lock (D8) |

**Rules in the builder** (each is tested):
- The estimate needs every required document **added and confirmed**, and every
  field marked `needsTick` **ticked by the person**. Anything missing becomes a
  blocker that links to its Review screen.
- A document confirmed as a different form than expected (the provider's
  `detectedForm`) is a blocker.
- A value that isn't a valid amount is a blocker, never rounded or guessed.
- Withholding and amounts of "Not on my form" (`mayBeBlank`) count as zero only when
  the person chose that.
- Output contains **no ID numbers**. A test fails if one appears.

---

## 5. Questions the estimate and forms need (not in the flow today)

| Need | Why | Proposal |
|---|---|---|
| Marital status (and dependents) | Filing status and table column; credits | New "Tax details" question: Single or Married. Married or dependents → blocking review for the estimate, with Other ways to file. |
| School name, address, phone | Form 8843 Part III line 9 | One short screen, or a short form screen |
| Director of your program: name, address, phone | Form 8843 Part III line 10 | Same screen. Plain help: "Usually your international student office." (TODO confirm) |
| "Did you apply for permanent residence this year?" | Form 8843 line 13 | New Yes/No. Yes → "needs review" (outside what we support today) |

These must be **new questions**, built the normal way (a screen in `screens.tsx`, a
section in the stepper). They're a step on their own (R8) so we can see them before
the forms use them. (Decided, section 14.)

---

## 6. Sequence and blocking rules

```
Documents ── Continue ──┬── still reading ──▶ Reading ──▶ Review (one document per screen, ticks)
                        └── all read ───────────────────────▶ Review
                                                                  │
                                                      all confirmed? ── no ──▶ stays on Review
                                                                  │ yes
                                                                  ▼
                              Your estimate (/result) ──▶ Download forms ──▶ How to pay (only if owed)
```

Carried over unchanged from the earlier plan:
- **Blocking rules (D8):** no download of anything until passport and I-94 exist and
  are confirmed. Form 8843 additionally needs the school questions (section 5) and
  the days in the U.S.
- **Editing after Ready:** changing a confirmed value, or replacing/removing a file,
  clears that document's confirmation (EXTRACTION-PLAN §5, §6). Changing any answer
  that feeds the estimate marks the estimate **stale**.
- **Leaving and returning:** "Save and exit" works on every screen. Home reads the
  state from `returnStatus()` and resumes at the first thing missing.
- **Motion:** spring tokens only (`quick`, `soft`, `fade`); reduced motion fades.
- **Sensitive data:** masked IDs only through `mask()`; nothing logged; fake data
  only in the repo.

New states for `returnStatus()`: `review` (confirm values), `estimate` (estimate
exists or is stale). Home **never shows the number**, in any state.

---

## 7. The result screen (`/result`, in the Review section)

One page, not counted as a stepper step. It combines the earlier plan's "summary of
confirmed documents" with the estimate, so there's no extra screen.

### 7.1 States

| State | What the person sees | The one cobalt button |
|---|---|---|
| **Blocked** (something required is missing or unticked) | "We can't give an estimate yet." A list of what's blocking, each item a link to the exact screen | **Fix what's missing** (goes to the first one) |
| **Needs review (no number)** (an unsupported situation) | "We can't estimate this one." Plain reason, what we couldn't compute, **Other ways to file** | **Download Form 8843** (if allowed) |
| **Refund due** | A calm positive moment: "We estimate a refund of **$407**." Success-colored check, nothing else celebratory | **Download your forms** |
| **Amount owed** | Neutral and practical: "We estimate you owe **$593**." No red, no alarm; owing isn't an error | **Download your forms**; **How to pay** is a secondary button |
| **Zero** | "We estimate you owe nothing, and no refund is due." | **Download your forms** |
| **Form 8843 only** | "Based on your answers, you only need Form 8843." (advisory review tag) | **Download Form 8843** |
| **Stale** (an answer or confirmed value changed) | **Number hidden.** "Something changed. Recalculate to see your estimate." | **Recalculate** |
| **Number switched off** | Same screens with no amount anywhere ("Your forms are ready") | unchanged |

Every number is labelled **Estimate (prototype)** (an eyebrow above it, always, in
`Small`). Under it: "Based on the details you confirmed. This is an estimate, not a
promise, and nothing has been filed." (TODO confirm with legal.)

### 7.2 "Show how we got this"

A disclosure under the number: a line-by-line breakdown in four groups (Income,
Deductions, Tax, Payments, then Result). Each row: plain label, the form line in
small muted text (`Form 1040-NR, line 1a`), the amount, and where it came from
("From your W-2, Sample Employer"). Rows with advisory flags get a **Needs review**
tag with the reason on tap. Below: **What we assumed** (single, no adjustments,
Tax Table method, no penalties or interest, no credits) and **IRS figures used**
(table and citation, tax year, `final` or `draft`).

### 7.3 Stale rule

The browser sends a hash of the answers that matter plus the server's hash of the
confirmed values. If either changed since the last calculation, the screen is
**stale**: the amount, the breakdown amounts and the live-region text are all
removed, and **Recalculate** is the only action. Recalculating is instant (pure
function), so no fake progress: a short `quick` cross-fade and the state announces
"Estimate updated".

### 7.4 Layout (same page grid as Home)

Phone: one column. iPad: 5 + 3 columns. Laptop: 8 + 4. Left: the hero card (shadow
2) with the state and the one button, then the breakdown card. Right: **Your
documents** (the confirmed list with **Edit**), **State return** card (section 10).
White cards, radius lg, 24 padding. The number is `Display` size (Fraunces 34/40),
with `tabular-nums`.

### 7.5 The visible switch that hides the number

- `ESTIMATE_NUMBER_VISIBLE` in `src/config.ts` (the default).
- A **visible prototype switch** ("Show estimate number") on the result screen's
  header, like the existing fake-sign-in badge, that overrides the default for this
  browser. It's always visible in prototype builds, so nobody forgets it exists.
- When off, **the number disappears everywhere**: the screen, the breakdown
  amounts, the live-region announcement, the downloaded forms (those lines print as
  "hidden in this prototype"), and the server doesn't send amounts. The states still
  work (blocked, ready, stale).

### 7.6 Motion, accessibility, contrast

- The number rises in with `soft` (opacity + 8px). Refund: the success check draws
  with `soft` (CLAUDE.md reserves `pop` for the upload check). Owed: no color, no
  icon motion. Reduced motion: both become a `fade`.
- One live region: "Estimate ready: refund of $407. Estimate, prototype." / "Estimate
  hidden. Something changed." Only on real changes.
- Focus: on load the headline; after Recalculate the new headline; breakdown opens
  with focus on its first row. 44pt targets, keyboard-only works.
- New color pairs go in `pairs.ts` (success on surface exists; "Needs review" tag on
  sage). `npm run audit:focus` gets a Result part.

---

## 8. Forms

Every downloaded page is labelled **Estimate (prototype). Not for filing.**

| Form | Plan |
|---|---|
| **Form 8843** | The official IRS PDF, filled from confirmed values and the new school questions. No calculation. Built first (step R8). **It must be the 2025 form**: the one I read is the 2026 version, so step R8 starts by fetching the 2025 form and re-checking its fields. |
| **Form 1040-NR** | Decided: our own **line-by-line estimate worksheet** (a PDF in our style) using 1040-NR line numbers, not the official form: the 2026 form is only a draft, and a filled official form looks fileable. A 2025 official-form fill can come later. (Decided, section 14.) |

Forms are generated **on demand** on the server, sent with `no-store`, never saved,
never logged. **Decided: every ID number on a download shows only its last 4
digits**, through the same `mask()` as the screens (SSN, ITIN, EIN, passport number;
nothing else is ever printed in full). So the downloads are estimates, not fileable
forms. A test reads the text of every generated PDF and fails if any ID number
appears unmasked.

---

## 9. How to pay (`/how-to-pay`)

Plain instructions only. **No payment details are collected anywhere, no app
payment screen, no amount field.** Reached from **How to pay** on the result screen
(owed state only) and from Documents' downloads.

Content (all placeholder text, **TODO confirm with CPA and legal**), from the 2025
instructions:

1. **Pay online from a U.S. bank account** with IRS Direct Pay (free, no sign-in).
2. **Pay by card or digital wallet** through an approved processor (processors may
   charge a fee, TODO confirm).
3. **Pay by check or money order** drawn on a U.S. bank. Write the form and year
   ("2025 Form 1040-NR"), your name, address, daytime phone and SSN or ITIN on it
   and attach Form 1040-V.
4. **No U.S. bank account?** Link to the IRS page for foreign electronic payments.
5. **When:** the year's due date from config (April 15, or June 15 if you had no
   wages with withholding; payment date TODO confirm).
6. One line: "AtlasTax never takes payment and never asks for bank or card details."
   (TODO confirm.)

Links open in a new tab (existing `ArrowSquareOut` icon), checked at build time.

---

## 10. State return: "coming soon" card

A card on the result screen: "State return. AtlasTax doesn't prepare state returns
yet." (TODO confirm; no dates, no "we'll notify you".) A `STATE_RETURNS` list in
config is empty, so the card shows for every state.

**How one state could be added later (not planned in depth):**

| Piece | What it takes |
|---|---|
| Residency | Questions per state (resident, part-year, nonresident); rules differ by state |
| Starting point | The federal result already carries AGI; most states start there |
| Rules | A `src/tax/states/<state>/<year>.ts` config, same pattern as federal: brackets, adjustments, how it treats scholarships |
| Engine | A pure `stateEstimate(federal, input)`, same tests approach (the state's instruction examples) |
| Inputs | W-2 boxes 15 to 17 are already in the field list |
| Form | The state's form, filled the same way as Form 8843 |
| Pay | A "how to pay" section for that state |
| Review | CPA and legal sign-off per state |

Recommendation: **choose the first state from real W-2 data** (box 15) once people
use the app, not by guessing. (Decided, section 14.)

---

## 11. Testing

### 11.1 IRS worked examples as tests

| # | Test | Source | Expected | Pre-check (my independent scratch run) |
|---|---|---|---|---|
| T1 | Taxable $25,300, married filing separately | 2025 Instructions p. 24 (Shannon) | tax **$2,801** | **$2,801 ✓** |
| T2 | Taxable $24,500, single | Pub. 519 (2025), Arthur Banks | tax **$2,705** | **$2,705 ✓** |
| T3 | Same: dividends 30% and treaty 15% (arithmetic only; dividends not in v1 scope) | same example | **$420 / $210** (totals $3,125 / $2,915) | **✓** |
| T4 | Full scholarship, no treaty: 8r = $9,000, credit $1,260 (box 2 $9,000, box 10 $1,260) | 2025 Instructions, "Line 8r" Example 1 | line 8r **$9,000**, line 25g **$1,260** | line amounts only; the IRS gives no final tax. We compute the rest from the table. |
| T5 | Same, treaty-exempt scholarship | "Line 8r" Example 2 | **no** 8r; line 1k **$9,000**; 25g **$1,260** | same |
| T6 | Internship, France treaty: 1a $3,000, 1k $5,000 | "Line 1a" Examples 1 and 2 (Jean) | 1a **$3,000**; 1k **$5,000** | same |
| T7 | Scholarship partly for services: $2,500 of which $1,000 is pay for services | Pub. 519 ch. 3 (Maria Gomez) | exclusion **no more than $1,500** | (blocks in v1: services) |

Honest limit: **the IRS publishes no complete worked 1040-NR for a student.** Only
T1 and T2 give a full tax figure; the others give line amounts. I haven't read all of
Pub. 519's ~25 examples closely. Step R4 includes a full pass.

### 11.2 Synthetic cases (2025, single)

Expected values were worked **from the IRS tables by a separate scratch script, not
by any engine**, and must be signed off by the CPA. (Made-up numbers.)

```
S1a job only, withheld enough       income 20,000  deduction   600  taxable 19,400  tax 2,093  paid 2,500 -> REFUND  $407
S1b job only, under-withheld        income 20,000  deduction   600  taxable 19,400  tax 2,093  paid 1,500 -> OWES    $593
S2  scholarship + job, no treaty    income 27,000  deduction   500  taxable 26,500  tax 2,945  paid 2,660 -> OWES    $285
S3  same, scholarship treaty-exempt income 18,000  deduction   500  taxable 17,500  tax 1,865  paid 2,660 -> REFUND  $795   (1k = 9,000)
S4  India student, std deduction    income 20,000  deduction 15,750  taxable  4,250  tax   428  paid 1,500 -> REFUND $1,072   (advisory review)
S5  no earnings                     -> Form 8843 only (advisory review)
```

Also tested (no tax math): blocked (missing document, unticked value, wrong form,
invalid amount), unsupported income, married/dependents, `draft` year tag, stale
detection, number switched off (nothing in server output), no ID number anywhere in
output, masked output in the browser, and the `needs review` lists.

### 11.3 More checks (step R4)

- **Every row of the IRS Tax Table** (about 2,000 rows) parsed from the 2025 Form
  1040 instructions and compared with the engine, which also settles the unverified
  small-income bands.
- **Properties**: tax never decreases as income grows; refund = payments − tax;
  rounding is whole dollars; same input twice gives the same output.
- **Config check** (`npm run check:tax`): every table is complete, its base taxes
  agree with its rates, every config value has a source.
- Output shown in the build step and kept in the review pack.

### 11.4 What a tax professional must review before any real student relies on a number

The **review pack** (generated by step R4, one document) lists, with the source next
to each: every table and figure (section 1), every `needs review` rule and why, the
income handling list (computed or blocked), the 1042-S pattern rules, the treaty and
India handling, the assumptions, the line map, all the synthetic cases with inputs
and results, and the unverified items. They must check:

1. All tables and deductions against the final IRS documents, including the **$15,000
   vs $15,750** conflict.
2. The Tax Table method, rounding, and the Tax Computation Worksheet above $100,000.
3. Itemized deductions: the state-and-local limit, charitable gifts, and what
   counts for a nonresident.
4. Scholarship treatment: the 1042-S pattern rules, services, non-degree candidates.
5. Treaty handling and India Article 21(2) eligibility; Schedule OI item L.
6. Who must file (including no-income students) and the Form 8843 rules.
7. The income types we block, and whether any can be computed.
8. Wording of every "estimate", "needs review" and assumption line.
9. Anything the engine **assumes** (single, no adjustments, no credits).

---

## 12. Rules that change (needs your OK before I touch them)

- **CLAUDE.md "Copy"**: add a narrow exception: *the result screen may show a
  calculated estimate labelled "Estimate (prototype)"; no promise language, nothing
  on Home, no marketing use, hidden by the switch.*
- **FLOW.md** Home note ("no refund estimates") stays true: Home never shows a number.
- **CLAUDE.md "Required documents / Documents page"**: add the tax engine's
  single-source rule: *all tax rules live in `src/tax/years/*`; components never
  compute or decide tax.*
- Add `npm run check:tax` to the build, like the other checks.

---

## 13. Build order (each step small, testable, ends with checks and a look)

I'm on **Sonnet 5.5** right now; the logic steps below should run on **Opus 5.5**.

| Step | What | What you'll see / how it's tested | Model |
|---|---|---|---|
| **R1 Transcription** | Fix the field list to the IRS boxes (1042-S Box 10; verify the rest). `buildTaxInput()` with its rules (section 4). Synthetic confirmed documents. | `npm run check:taxinput`: every mapping, every blocker, no ID numbers in output | Opus |
| **R2 Engine core + 2025 config** | `years/2025.ts` with sources, Tax Table method, wages-only returns. | `npm run check:tax`: T1, T2, S1a, S1b | Opus |
| **R3 Engine: scholarships, treaty, India, itemized, flags** | Every rule in section 2, blocking and advisory. | T4, T5, T6, S2 to S5, all flag cases | Opus |
| **R4 Test pack and review pack** | Every Tax Table row, properties, the CPA review pack. **Test output shown.** | Output, and the pack file | Opus (tests), Sonnet (pack layout) |
| **Existing 4 to 6** | Consent sheet, Reading page, Review screen with ticks (as in EXTRACTION-PLAN). Needed before real data reaches the engine. | as already planned | Opus logic, Sonnet polish |
| **R5 Estimate endpoint + stale logic** | `POST /api/estimate`, hash, `none \| fresh \| stale \| blocked`, number switch on the server | `check:server` additions | Opus |
| **R6 Result screen, all states** | Section 7.1, 7.4, 7.5, fixtures `?result=blocked\|refund\|owed\|zero\|stale\|review\|8843` | Look at each state on phone, iPad, laptop | Opus (states), Sonnet (UI) |
| **R7 Breakdown, assumptions, review tags** | Section 7.2 | Screenshots; focus audit | Sonnet |
| **R8 New questions + Form 8843** | Section 5 questions; official Form 8843 filled; labels | Download and open it; fake data only | Opus (mapping), Sonnet (screens) |
| **R9 1040-NR estimate worksheet PDF** | Section 8 | Download and open it | Sonnet |
| **R10 How to pay + State card** | Sections 9 and 10 | Look at both | Sonnet |
| **R11 2026 config (later)** | `years/2026.ts` (`draft`), year switch tests; re-check when the IRS posts the final form; then `TAX_YEAR` can move to 2026 | check:tax for 2026 | Opus |
| **R12 Audit and copy** | focus audit Result part, contrast pairs, CLAUDE.md edits (section 12), copy review | all checks green | Sonnet |

---

## 14. Decisions (approved Nov 15, 2026)

| # | Question | Decision |
|---|---|---|
| 1 | Tax year | **2025 first**, and the whole app reflects 2025 (done). 2026 later as `draft` (R11). |
| 2 | Treaties | Applied only when the **1042-S itself shows it**; advisory "needs review" tag. |
| 3 | India standard deduction | Applied automatically for citizens of India (greater of that or itemized); advisory tag. |
| 4 | Unsupported income types | **Block the number** (no partial number). |
| 5 | The switch | Hides the number **everywhere** (screen, breakdown, live region, downloads, server response); visible on the result header. |
| 6 | Forms | Our own 1040-NR **estimate worksheet**; Form 8843 official (2025 version). **Every ID number shows only its last 4 digits, including on downloads.** |
| 7 | New questions | One short screen for school and program director (R8). Marital status and dependents, and the permanent-residence question, as in section 5. |
| 8 | Copy exception | **Approved**, written into CLAUDE.md ("Copy"). |
| 9 | First state | Decided later, from real W-2 data. |
| 10 | Where the engine runs | **Server**. |
| 11 | Primary button when owed | **Download your forms**; **How to pay** secondary. |

**Add to the CPA list:** the full list in section 11.4, plus: bank interest for
nonresidents, whether 1040-NR is required with no income, FICA withheld in error
(W-2 boxes 4 and 6, not refunded on this return), the June 15 rule and the payment
date, estimated-tax penalty and interest, Schedule 1-A eligibility, Form 8843 filed
alone (due date and address), and **late filing of a 2025 return** (due dates have
passed).

**Add to the legal list:** whether showing a computed estimate counts as tax advice or
preparation (and any registration, disclosure or consent rules that apply to tax
return preparers; legal to say which), whether "Estimate (prototype)" labelling is
enough, wording of every disclaimer, retention of amounts and confirmed values, showing
full ID numbers on downloads, and the "never takes payment" line.
