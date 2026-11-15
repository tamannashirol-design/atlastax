# AtlasTax flow

Taken from the old screens in `/references`, plus answers from the designer.
This covers flow, copy and logic only. It does not describe visual style.

Every question screen (steps 1 to 7) uses the same layout: progress (step X
of 7), back, question, answer options, "why we ask" helper line, an optional
help link, and Continue.

## Order at a glance

0. Intro: the logged-out entry page ("/" while logged out)
1. Home
2. **About you:** Visa type (J-1: "Are you in the U.S. as a student?") ·
   Enrolled · State · Country of citizenship
3. **Time in the U.S.:** first arrival year · arrival date (sometimes) ·
   a full year abroad (sometimes) · trips out of the U.S. · check
4. **Tax details:** SSN / ITIN · Filed U.S. taxes before? ("Yes" opens the
   "Previous return" sheet)
5. **Income:** income sources + follow-ups
6. **Documents** (one page for the tab and the flow)
7. **Review** (not built yet)

## Built screens (routes)

| Route | Screen | Answer control |
|---|---|---|
| /visa | Visa type | Tiles F-1 / J-1 / M-1 |
| /j1-student | J-1 only: "Are you in the U.S. as a student?" | Tiles Yes / No. No → "We don't support this yet." sheet |
| /enrolled | Enrolled at a U.S. university or college? | Tiles Yes / No |
| /state | State | Dropdown: phone picker below 600px, custom list above |
| /citizenship | Country of citizenship | Searchable country list |
| /arrival-year … /time-in-us | Time in the U.S. (see that section) | |
| /tax-id | SSN / ITIN | Tiles SSN / ITIN / N/A |
| /filed-before | Filed before | Tiles Yes / No; Yes opens the previous-return sheet |
| /income | Income sources | Multi-select income cards in two groups (see below) |

## Stepper sections

Six sections (`src/flow/sections.ts`, the one section config). Screens name
their section; the "x of n" and the segment fill are derived from the
screens that apply to this person, so they always match. One segment per
section. "2 of 3" is shown only for sections with more than one step.

| # | Section | Steps (when they apply) |
|---|---|---|
| 1 | About you | Visa type, J-1 student?, Enrolled, State, Country of citizenship |
| 2 | Time in the U.S. | Arrival year, Arrival date, Full year abroad, Trips, Check |
| 3 | Tax details | SSN or ITIN, Filed before |
| 4 | Income | Income sources + follow-ups |
| 5 | Documents | One page |
| 6 | Review | Review and submit |

## Time in the U.S. (built: `src/residency/`, rules in `src/residency.config.ts`)

Students only for now: F-1 (including OPT and CPT), J-1 student, M-1. A J-1
who isn't here as a student sees "We don't support this yet." (no
calculation). The J-1 researcher rules stay in config, unused, marked TODO.
Every rule is a placeholder: **TODO confirm with CPA**. Each question is its
own screen in the standard question layout.

| Route | Question | When | Why we ask (helper) |
|---|---|---|---|
| /arrival-year | What year did you first arrive in the U.S. as a student? | always | Your first years as a student are counted differently |
| /year-abroad | Did you spend a full calendar year outside the U.S.? (Yes → pick the years) | arrival → tax year spans more than 5 calendar years (5 or fewer: can't change the result) | A full year away isn't counted as one of your student years |
| /not-supported | **Stop screen:** We can't prepare your return yet | outside the v1 scope (see below) | — |
| /arrival-date | What date did you arrive? | within scope, and the arrival year is one Form 8843 asks days for | To count your days in the U.S. that year |
| /trips | Did you leave the U.S. in {Form 8843 years since arrival}? | within scope | To count your days in the U.S. for Form 8843 |
| /time-in-us | Check your time in the U.S. | within scope | Change anything that doesn't look right |

**v1 scope (TODO confirm with CPA; rule in `residency.config.ts`):** AtlasTax
prepares a return only when the tax year is within the person's first 5
calendar years in student status (F-1 including OPT and CPT, J-1 student,
M-1). Every calendar year with any presence counts, a calendar year spent
entirely abroad doesn't, and the tax year counts: the sixth year is outside
scope. The gate runs right after the year-abroad question (or right after
the arrival year when that question is skipped, which always means within
scope).

- **Outside scope:** the stop screen, "We can't prepare your return yet",
  "AtlasTax currently supports students in their first five calendar years
  in the U.S. Based on your answers, your situation may need a different
  type of return." Cobalt **Check my answers** (back to the arrival year),
  quiet **Save and exit** (Home), and a note: "Your school's international
  office or a tax professional can tell you which return applies." (TODO
  confirm wording). No travel days or I-94 questions; Tax details, Income,
  Documents and Review can't be reached (typed addresses redirect to the
  stop screen); the stepper shows only About you and Time in the U.S.
  Never says "resident"; no advice; no jargon.
- Changing an answer back into scope continues the flow from there.

- Question wording shortened to fit 3 lines on a phone: "Did you spend a
  full calendar year outside the U.S.?" (brief: "Was there a full calendar
  year when you weren't in the U.S. at all?").
- Form 8843 line 4a asks for days in the tax year and the 2 years before it
  (2026, 2025, 2024 for a 2026 return); only years from the arrival on.
- Trips: No → every day from arrival (or Jan 1) to year end. Yes → "Left on"
  / "Came back on" rows, "Add another". Days in the U.S. = days in the year
  minus days abroad; the days you leave and come back count as days in the
  U.S. (any part of a day counts). Dates are counted as a set, never twice.
- Only rows that need attention are highlighted (text + icon): no return
  date ("Are you still outside the U.S.?" → "Yes, I'm still away"), came
  back before leaving, overlapping trips, a trip before arrival, a missing
  departure (from travel history), a history that may be cut off.
- Optional shortcut: "Fill this in from your I-94 travel history" (upload;
  reading is a STUB with sample trips). Helper: "Get it from the CBP I-94
  website (i94.cbp.dhs.gov) under 'View Travel History'…" (TODO confirm the
  label). "Remove travel history" deletes the files and the trips read from
  them. Travel history stays in this browser tab only.
- The most recent I-94 is a separate Identity document (Documents page).
- Check screen (only within scope): one sentence, "2026: year 4 of your
  first 5 calendar years as a student", then the days per year, each with
  Edit, and "These go on Form 8843…". "Show how we counted" (collapsed)
  holds the working. No jargon.
- `npm run check:residency` runs the cases.

Persistent across the app (old version): bottom tab bar with 3 tabs (Home,
Documents/Scan, Profile), a menu button, and a security/trust badge.

---

## 0. Intro: the logged-out entry page (built: `src/intro/`, `src/landing/`)

Audience: logged-out people. "/" while logged out IS the intro page.
Logged-in people skip it and land on Home; they can replay it from Help on
Home (in a dialog). No real sign-in yet: a fake switch for testing (the
"Logged in (fake)" toggle on /motion, or ?auth=in / ?auth=out).

The page:
- AtlasTax logo (static here; it only animates on the logged-in Home).
- "For students on F‑1, J‑1 and M‑1 visas filing U.S. taxes."
  (**TODO confirm**; audience only, no outcome promises).
- The scenes (below), **Get started** (the one cobalt button; starts the
  current year's return; **TODO confirm:** account creation will come first
  once accounts exist) and a quiet **Log in** link (placeholder page).
- Footer: Privacy, Terms, Contact (placeholder pages, **TODO confirm**).
- No testimonials, counts or unverified claims.

Scenes are a data array (`src/intro/content.ts`): a fourth can be added
there without layout changes (dots, tabs, timing and announcements all come
from the array). Generic data only:

| # | Heading (from the brief) | Text (TODO confirm: draft) | Demo |
|---|---|---|---|
| 1 | Answer a few simple questions | One question at a time, about your visa, your studies and your income. | Two questions in a row, each with its answer tiles and one tile picked: visa type (F‑1), then "Are you currently enrolled at a U.S. university or college?" (Yes). No Continue button |
| 2 | Add your documents | Upload forms like your W-2 as a PDF or a clear photo. | Upload zone: "W-2 · Example Employer.pdf" drops in, progress draws, check lands (scripted; nothing is uploaded) |
| 3 | Get your forms, ready to file | We prepare Form 1040‑NR from your answers for you to download. | Form card settles in, "Example data" |

Timing: each scene moves on 1s after its moment ends (scene 1 ≈ 4.4s,
scene 2 ≈ 4.4s), until the person takes over. Never with reduced motion
(then: finished states, 150ms fades, no movement).

Two compositions, same scenes, copy and components (chosen by the intro's
own width, so /motion previews are exact):

**Phone (below 768px):** full-screen scenes; swipe or ← → to move; auto-
advance stops once the person touches anything.

**Wide / web intro (768px and up):**
- 1024+: steps as a vertical tablist in columns 1–5 (active: heading +
  sentence and a navy line that fills while it plays; others: heading only),
  Get started + Log in at the bottom of the column. Columns 6–12: "Preview"
  and the real laptop layout (stepper rail + question column) in a card.
- 768–1023 (iPad portrait): the steps become a row of tabs above the demo.
- Clicking a step jumps to it. Auto-advance pauses on hover or focus and
  stops for good after the first click or key press. Scenes cross-fade.
- Demo hidden from screen readers and not clickable; the panel describes it
  in text.

Replay (from Help on Home): same intro in a dialog, with Skip (and Escape)
instead of Log in and the footer; phone has Next, then Get started.

To see it: log out with the /motion toggle (or ?auth=out) and open "/";
or /motion → Intro, with a 390 / 820 / 1032 / 1280 width toggle and
"Logged-out page" / "Replay" versions.

## Required documents (step 1 of 3: built)

- Rules: `src/documents.config.ts`, the ONLY place that says which income
  needs which document. **TODO confirm with CPA:** all values are placeholders,
  including `reportableWithoutForm` and what to collect for self-reported items.

  | Income | Document | Form question | reportableWithoutForm | If "No, I didn't get one" |
  |---|---|---|---|---|
  | Bank interest | 1099-INT | "Did you get a tax form?" | yes | self-reported item, "Details needed" |
  | OPT or CPT job | W-2 | — | no | — |
  | On-campus job | W-2 | — | no | — |
  | Scholarship | 1042-S | — | no | — |
  | Freelance | 1099-NEC | "Did you get a 1099-NEC?" | yes | self-reported item, "Details needed" |
  | Investments | 1042-S or 1099-DIV | — | no | — |
  | Trading | 1099-B or 1042-S | — | no | — |
  | Contract work | 1099-NEC | "Did you get a 1099-NEC?" | no | still a document (form expected) |

- Picking an income card registers the income, whatever the form answer.
- One function, `requiredItems(answers)` (`src/flow/requiredDocuments.ts`),
  returns two kinds of items:
  - **documents** (a form is expected): added, later ("I'll add it later"),
    none ("I don't have this", reported on the Documents page) or missing.
    later and none are deferred.
    Before the form question is answered, a form is expected.
  - **self-reported income items** (income registered, no form): "Details
    needed", or later if deferred.
- Counts (same words everywhere, from `documentsLine` / `incomeItemsLine`):
  "2 of 3 documents added" counts documents only; a separate line says
  "1 income item needs details". The Documents step is done when no
  document is missing and no self-reported item still needs details (unless
  deferred with "I'll add it later").
- Documents page (step 2): self-reported items in their own small group with
  "You told us you had this income. We'll ask for the details here." No tax
  advice, amounts or thresholds; what to collect is TODO confirm with CPA.
- Everything calls the function: the flow's upload questions (they appear
  only when a form is expected), the income cards' form codes, and next the
  Documents page, the stepper and Home. `npm run check:documents` prints the
  table and runs 12 cases.
- **TODO confirm with CPA:**
  - Contract work should match freelance? Both are 1099-NEC, but only
    freelance is reportableWithoutForm. Kept as is for now: contract work's
    "No" still expects a 1099-NEC (the flow shows the upload question, then
    the amount question).
  - "Or" documents (investments: 1042-S or 1099-DIV; trading: 1099-B or
    1042-S) count as ONE document: any uploaded file marks it added,
    whichever form it is.
  - What to collect for self-reported items.

## Documents page (step 2 of 3: built, `src/documents/DocumentsPage.tsx`)

- ONE page: the Documents tab (/documents) and the flow's Documents step
  (after the last income question) open the same page.
  - From the flow: back arrow, the stepper (compact; rail at 1024+) and
    **Continue** (to Review, enabled once nothing is outstanding). "From the
    flow" is kept in history state, so a reload keeps it.
  - From the tab: title "Documents", tab bar, no stepper, no Continue.
- Summary: "2 of 3 documents added" + thin navy bar (documents only), and
  "1 income item needs details" on its own line. None: "No documents needed
  yet" with "Why no documents yet?" (explains it depends on the income you
  tell us about, links to the income question).
- Your documents: form + who sends it, status as text and an icon (Added ·
  n files / You'll add it later / You don't have this / Not added yet).
  Upload opens a sheet with the real upload (same answer as the flow's
  upload question). Not added: "I'll add it later" and "I don't have this"
  (both on every document here; the flow's upload sheets offer "I'll add it
  later" only, so a missing form is reported here). Deferred: Undo.
- Income without a form: "You told us you had this income. We'll ask for
  the details here." Status "Details needed"; "I'll add it later" / Undo.
  What to collect: TODO confirm with CPA (nothing collected yet).
- Each item has its own address: /documents#item-<id> scrolls to it and
  focuses it (Home's links in step 3 use this).
- Stepper: Documents shows done only when requiredItems() says nothing is
  outstanding. "Continue where you left off" goes to Documents (from the
  flow) once the questions are done, until then.
- W-2 upload question is neutral: "Upload your W-2", "From your employer.
  One per employer" (no longer names OPT or CPT).

## Next steps (agreed order)

3. **Logged-in Home**, to this brief (pasted by the designer):
   - Focus only on the user's tax return. No deadlines, news, refund
     estimates or promises about outcomes.
   - Fake states for testing, switchable on /motion and with
     ?home=new|progress|ready: new (nothing answered); progress (visa,
     state and income answered, one document added); ready (everything
     done, forms ready to download).
   - Return card (hero): "2026 tax return" (TAX_YEAR), the 5-section
     progress row from the stepper with the current section labelled, one
     line of status ("Income: 2 of 3 answered" or "3 documents left"). One
     cobalt button: "Start your return" (new), "Continue where you left off"
     (progress), "Download your forms" (ready; the card then lists the
     forms, each with Download). The only cobalt element.
   - What's next: the next 2 or 3 steps computed from the state, each a
     link; document steps link to that item on the Documents page.
   - Documents summary row (not a card grid, no illustrations): "2 of 3
     documents added", a thin navy progress bar, "View documents" link.
     None required: "No documents needed yet", with a link explaining why.
     Status as text, never color alone.
   - Your answers: compact list (visa type, state, income types), each with
     an Edit link to that question.
   - Previous years: quiet row, years enabled in config.
   - Privacy and storage: config-driven line, empty until confirmed.
   - Help: "Not sure what applies?" and "Replay intro".
   - Layout: phone one column in this order. iPad and laptop: main column
     (return card, What's next, Documents summary) and a narrower side column
     (Your answers, Previous years, Privacy, Help) on the 12-column grid.
     Same radius and padding tokens on all cards; nothing floating.
   - Motion (existing tokens): cards enter with the stagger; the progress
     row fills on load. Reduced motion: fades only.
   - Accessibility: headings in order, each card a labelled region, status
     as text and an icon, visible focus rings, keyboard operable.
   - All three states on /motion with a width toggle.
   - After each step: test at 390, 820, 1280px, audit and contrast, commit, stop.

## Planned

- **Intro scene: documents being deleted.** A scene showing documents being
  deleted, using the interaction at
  https://designeer.xyz/finds/heydamir-2109679416494391746 (timing and
  behaviour only; visuals from our design system). Add it only after the
  delete-documents feature exists in the app. Not built.

## 1. Home (built: `src/home/`)

The landing screen for everyone logged in ("/"), in every state of the
return. The questions start only from Home's button; every question has
"Save and exit" (answers save as you go) and the first question's back
arrow returns to Home. /welcome always shows the intro; its Get started
lands on Home (after a FAKE sign-in for now; TODO confirm real accounts).

State comes from ONE function, `returnStatus(answers, year)`
(`src/home/returnStatus.ts`), which Home and the Documents page use:
{ state, headline, buttonLabel, buttonTarget, progress, nextSteps } plus
the documents summary and "Your answers". Test states: ?home=new|progress|
documents|ready|notsupported (doesn't change saved answers).

| State | Hero headline | Cobalt button (the only one) | Below the hero |
|---|---|---|---|
| new | Let's start your return | Start your return | Things you may need (TODO confirm): Passport and I-20 · Your W-2 or 1042-S · Travel history |
| in-progress | You're on step N of 6: {section} | Continue where you left off (next unanswered question, or Documents) | What's next (links) · Your answers (Edit) |
| needs-documents | Next: add your documents | Add documents | What's missing (each links to its item on Documents) · Documents summary · Your answers |
| ready | Your return is ready | Download your forms (TODO: real forms; goes to Review, not built) | Your forms (PDF buttons, TODO) · Your answers with "Review again" |
| not-supported | We can't prepare your return yet (+ the neutral paragraph and note) | Check my answers (to the arrival year; J-1 non-student: to "student?") | nothing (no progress row, documents or What's next) |

- Hero: "2026 tax return", the headline, one plain sentence (TODO confirm),
  the progress row (all 6 sections with names: done = check, current =
  bold), the button. No illustrations in the hero.
- Layout: phone one column; iPad 5 + 3 columns; laptop 8 + 4. The hero and
  the side column share a top edge. White cards (radius lg, shadow) on the
  page background.
- "Filing for an earlier year?" opens a sheet listing PREVIOUS_TAX_YEARS
  (config). Privacy line: PRIVACY_LINE (config), hidden until confirmed.
- "Replay intro" lives on Profile now. No Help, how-it-works, deadlines,
  news, time estimates or promises; no jargon.
- Motion: the hero rises in, cards stagger, the progress row fills once;
  the hero's text and button cross-fade on a state change. Reduced: fades.
- The logo settles in once per session (Logo settle).
- Fake sign-in (testing only): defaults to logged in; the header shows
  "Logged in (fake)" / "Logged out (fake)" (tap to switch); ?auth=in /
  ?auth=out; remembered in localStorage.

## 1 (old). Home, from the reference
**Source:** `Homepage.png`
**Purpose:** Start or resume a return.

- Greeting: "Hi User,"
- Primary action: **File for 2025**
- Secondary: "File for previous years": **2024**, **2023**, **2022**
- Upcoming deadlines (timeline):
  - 03/15/25: Deadline for Schools to Issue 1042-S
  - 04/15/25: Federal Tax Filing Deadline
  - Note: "Deadlines will update once we learn more!"
  - Link: View More
- Recent news (article cards with image + headline), for example:
  - "Extra cost, paperwork: US visa changes may upend Indian students' plans"
  - "OPT Fair Tax proposes no financial relief for foreign students working in the US: What it means for those under F-1 visa"
  - "Student Visa Rule Changes: How They Could Impact Your U.S. Tax Residency"
  - Link: View More

**Next:** File for 2025 → Q1. Previous years (2024, 2023, 2022) use the
exact same flow; only the tax year changes.

## 2. Q1: Visa type (step 1)
**Source:** `Visa.png`
**Question:** "What is your visa type?"
**Answers (single choice):** F-1, J-1, M-1
**Why we ask:** "To personalize the experience and show only visa-relevant forms"
**Help link:** "Not sure about your visa type?"
**Action:** Continue (disabled until an answer is picked)

## 2b. Enrolled (About you, step 2 of 4)
**Source:** Designer (no reference screen)
**Question:** "Are you currently enrolled at a U.S. university or college?"
**Answers (single choice):** Yes, No
**Why we ask:** "To check your student status for the right forms"
**Help link:** None
**Action:** Continue. Both answers go on to State; nothing
branches on it yet.

> ⚠️ **Flag for tax review:** confirm the helper wording, and what (if
> anything) "No" should change: for example, students on OPT after
> graduation are no longer enrolled.

## 3. (removed) Years on this visa

Replaced by the "Time in the U.S." section above. The "We can't file this
return" sheet is gone: there is no automatic routing; the check screen shows
a neutral sentence instead.

## 4. Q3: State (step 3)
**Source:** Designer (no reference screen)
**Question:** "What U.S. state do you currently live or study in?"
**Answer:** Dropdown of the 50 states plus DC
**Why we ask:** "To identify if a state tax return is required"
**Help link:** None
**Action:** Continue

## 5. Q4: SSN / ITIN (step 4)
**Source:** Designer (no reference screen)
**Question:** "Do you have a Social Security Number (SSN) or ITIN?"
**Answers (single choice):** SSN, ITIN, N/A
**Why we ask:** "To decide if you can e-file or must paper file."
**Help link:** "Not sure whether you have it?"
**Action:** Continue

## 6. Q5: Filed before (step 5)
**Source:** `ssn add q.png`
**Question:** "Have you filed U.S. taxes before?"
**Answers (single choice):** Yes, No
**Help link:** "Not sure whether you have filed before?"
**Action:** Continue. "No" goes straight to Q6. "Yes" opens the sheet below.

**Follow-up sheet (only after "Yes"):**
- Title: "To continue, we'll ask for your previous tax return."
- Body: "This is optional, but uploading it will save you time and reduce errors."
- Actions: **Skip for now** / **Upload file**
- Close button (X)

## 7. Q6: Income sources (step 6)
**Source:** `Finance picture.jpg` (version A), `job add q.png` (version B)
**Question:** "Select the ones that apply to you"
**Answers:** one multi-select list of 11 options (each with an illustration)
in two groups on the same screen. It merges both old versions.

**Group 1: Income** (no group heading; it sits under the main question)
1. Bank Interest
2. OPT/CPT
3. On-Campus Job
4. Scholarship
5. Freelance
6. Investments
7. Trading *(from version B)*
8. Contract Work
9. No Earnings *(from version B)*

**Group 2: "Anything else that applies?"**
10. Donation *(from version A)*
11. Child Care *(from version A)*

**Rules:**
- **No Earnings** is exclusive. Picking it clears every other pick in both
  groups. Picking anything else unchecks No Earnings.
- Continue is enabled once at least one option is picked.

**Action:** Continue

*Background:* the two old versions differed only in the bottom row (A: Donation,
Contract Work, Child Care; B: Trading, Contract Work, No Earnings). Donation and
Child Care are deductions and credits rather than income, which is why they sit
in their own group.

**Follow-up sheet per selection** (example for On-Campus Job):
- Title: "You selected On-Campus Job. We just need a few more details."
- Body: "These quick questions help us file your taxes accurately. You are almost there!"
- Action: Continue (arrow)
- Close button (X)

### Q6 follow-up: Scholarship withholding (still step 6)
**Source:** `scholarship.png`
**Shown when:** Scholarship was selected in Q6.
**Question:** "Did your university withhold any tax from your scholarship?"
**Answers (single choice):** Yes, No
**Why we ask:** "To check refund eligibility"
**Help link:** "Not sure whether tax was withheld?"
**Action:** Continue

Other income types presumably have their own follow-ups. Only Scholarship
has a reference screen.

## 8. Q7: Country of citizenship (step 7)
**Source:** `treaty.png`
**Question:** "What is your country of citizenship?"
**Answer:** Dropdown, placeholder "Select one"
**Why we ask:** "To automatically check tax-treaty eligibility"
**Help link:** "What is a tax-treaty?"
**Action:** Continue

## 9. Document checklist
**Source:** `Document Upload.png` (empty), `Document Upload 5.png` (complete)
**Title:** "Document Checklist"
**Sections (each one is an upload row):**
- Income: "Click to Upload Income Forms"
- Education: "Click to Upload Education Forms"
- Visa: "Click to Upload Visa Documents"
- Supporting: "Click to Upload Additional Forms"

**States:** each row shows a check mark once uploaded.
**Actions:**
- Always: **Download Checklist PDF**
- When all four are complete: **File 2025** appears and becomes the main action

## 10. Review forms
**Source:** `Document Upload 7.png`
**Title:** "Your Forms Are Ready"
**Subtitle:** "Review your forms to confirm everything is correct before submitting"
**Content:** Preview of the generated Form 1040-NR (U.S. Nonresident Alien Income Tax Return, 2025)
**Actions:**
- Primary: **Submit Forms**
- Secondary (quieter): **Review Forms**

## 11. Ready to submit
**Source:** `Document Upload 8.png`
**Title:** "Your forms are ready for submission."
**Body:** "Download, sign, and mail your forms to the IRS."
**Action:** Arrow button downloads the checklist PDF. *(Placeholder for now:
no real PDF yet.)*

---

## Q6 Income screen (built: /income)

- Question: "Select the ones that apply to you" (one line on iPad and laptop;
  balanced wrap on phone). Multi-select cards, same size everywhere (2 grid
  columns each): 2 across on phone, 3 at 600–1023px (iPad portrait, same left
  edge as the other screens), 4 at 1024px+ (laptop, iPad landscape: heading
  and cards span 8 columns, Continue keeps the usual width). The 8 income
  types fill 2 full rows at 4 across.
- Form code under the label only where one form clearly applies:
  OPT or CPT · W-2, On-campus job · W-2, Scholarship or fellowship · 1042-S,
  Freelance · 1099-NEC, Contract work · 1099-NEC. Left blank for Bank interest,
  Investments and Trading, where the form can differ for nonresidents
  (to confirm with a tax professional).
- "No earnings" is not a card: a slim full-width row ("None of the above")
  below the 8 income cards, at every size.
- Group 2 "Anything else that applies?": Donation, Child care.
- Continue goes to /income/details (follow-ups, not built yet).

## Income follow-ups (proposal approved; v1 built)

Each selected type gets a short follow-up (the old flow showed a sheet: "You
selected On-Campus Job. We just need a few more details."). The proposal below
only collects information and documents; it does not decide any tax treatment.
Items marked **(tax review)** depend on rules a tax professional should confirm
before we write questions for them.

| Income type | Proposed follow-ups | Why |
|---|---|---|
| Bank interest | Did you get a form for this interest? (upload it, or "No form") · Total interest amount if no form | The return needs the amount; a bank form, if any, already has it |
| OPT or CPT | Upload your W-2 (one per employer; "Add another") · Was it OPT, CPT, or both? | The W-2 has wages and withholding; OPT/CPT tells us which work authorization the job falls under |
| On-campus job | Upload your W-2 (one per employer; "Add another") | Same document source as other wages |
| Scholarship or fellowship | Did your university withhold any tax from your scholarship? (Yes / No, from the old flow) · Upload your 1042-S, or "I'll add it later" · Did part of it pay for things other than tuition and required fees? **(tax review)** | The old flow already asks about withholding; the 1042-S holds the amounts; the last question only matters if a tax professional confirms it should be asked |
| Freelance | Upload each 1099-NEC, or enter the total you were paid if there's no form · Did you have work-related expenses? **(tax review)** | We need what you were paid; whether expenses can be counted needs confirmation |
| Investments | Upload your brokerage or bank tax form(s) (1042-S or 1099-DIV), or "No form" | The forms list dividends and any tax withheld |
| Trading | Upload your brokerage tax form(s) (1099-B or 1042-S), or "No form" | The forms list sales; nothing else should be asked until we know what's needed **(tax review)** |
| Contract work | Same as Freelance | Same kind of documents |
| No earnings | No follow-up | Nothing to collect |
| Donation | Organization name · Amount · Upload the receipt | The receipt and amount are what any claim would rely on **(tax review)** for whether nonresident filers can use it |
| Child care | Hold: no questions until a tax professional confirms whether and how this applies to nonresident filers **(tax review)** | Avoids asking for information we may not be able to use |

### What's built (v1)

Defaults chosen (to confirm): one question per screen, in income-card order;
**uploads open as slide-up sheets** over the question before them (like the
previous-return sheet): the upload, Continue (after a real upload) and the
skip "I'll add it later" as a secondary button (every upload). If they don't
actually have the form, they say so on the Documents page ("I don't have
this"). Two uploads in a row: the next sheet replaces
the first. The routes below still work (they open the page with the sheet). The old "You selected …" interstitial sheet is
not used. Items marked (tax review) are not built: scholarship costs, freelance
and contract expenses, Donation, Child care.

| Route | Shown when | Question | Answer |
|---|---|---|---|
| /income/bank-form | Bank interest | Did you get a tax form for your bank interest? | Yes / No |
| /income/bank-upload | …and Yes | Upload your bank interest form | Upload · "I'll add it later" |
| /income/bank-amount | …and No | How much bank interest did you earn in {year}? | Amount |
| /income/opt-type | OPT or CPT | Was this work OPT, CPT, or both? | OPT / CPT / Both |
| /income/opt-w2 | OPT or CPT | Upload your W-2 (helper: "From your employer. One per employer"; neutral, doesn't name OPT or CPT) | Upload · "I'll add it later" |
| /income/campus-w2 | On-campus job | Upload your W-2 from your on-campus job | Upload · "I'll add it later" |
| /income/scholarship-withheld | Scholarship | Did your university withhold tax from your scholarship? | Yes / No |
| /income/scholarship-1042s | Scholarship | Upload your 1042-S for your scholarship | Upload · "I'll add it later" |
| /income/freelance-form | Freelance | Did you get a 1099-NEC for your freelance work? | Yes / No |
| /income/freelance-1099 | …and Yes | Upload your 1099-NEC forms for freelance work | Upload · "I'll add it later" |
| /income/freelance-amount | …and No | How much were you paid for freelance work in {year}? | Amount |
| /income/investments-upload | Investments | Upload your investment tax forms | Upload · "I'll add it later" |
| /income/trading-upload | Trading | Upload your brokerage tax forms | Upload · "I'll add it later" |
| /income/contract-form, -1099, -amount | Contract work | Same as Freelance, for contract work | |

Every upload (these screens and the previous-return sheet) lists the uploaded
files below the zone, each with "Remove". Remove asks to confirm ("Remove
W2-acme.pdf?"), then takes the file off that question; removing the last one
empties the question again (Continue locks; the skip link comes back).

After the last follow-up, Continue goes to /documents (not built yet).
The scholarship question is shortened from the old copy ("Did your university
withhold any tax…") so it fits 3 lines on a phone.

## Open questions
1. **Q6 follow-ups:** which follow-up questions belong to each income type?
   Only Scholarship has one so far.
2. **Q6 overlap:** Trading and Investments: one option or two?
3. **Q6 follow-ups:** see the proposal above.

## Needs legal review
- Q2: the 5-year boundary and its wording (see Q2 above).
