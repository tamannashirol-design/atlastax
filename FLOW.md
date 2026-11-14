# AtlasTax flow

Taken from the old screens in `/references`, plus answers from the designer.
This covers flow, copy and logic only. It does not describe visual style.

Every question screen (steps 1 to 7) uses the same layout: progress (step X
of 7), back, question, answer options, "why we ask" helper line, an optional
help link, and Continue.

## Order at a glance

1. Home
2. Q1: Visa type
   - Enrolled at a U.S. university or college? (added by the designer)
3. Q2: Years on this visa
4. Q3: State
5. Q4: SSN / ITIN
6. Q5: Filed U.S. taxes before? ("Yes" opens the "Previous return" sheet)
7. Q6: Income sources (multi-select in two groups; each pick opens a follow-up sheet, then follow-up questions such as Scholarship withholding)
8. Q7: Country of citizenship
9. Document checklist (empty, then complete)
10. Review forms
11. Ready to submit

## Built screens (routes)

| Route | Screen | Answer control |
|---|---|---|
| /visa | Q1 Visa type | Tiles F-1 / J-1 / M-1 |
| /enrolled | Enrolled at a U.S. university or college? | Tiles Yes / No |
| /years | Q2 Years on this visa | Tiles "< 5" (Less than 5 years) / "5+" (5 years or more) |
| /state | Q3 State | Dropdown: phone picker below 600px, custom list above |
| /tax-id | Q4 SSN / ITIN | Tiles SSN / ITIN / N/A |
| /filed-before | Q5 Filed before | Tiles Yes / No. Continue with Yes opens the previous-return sheet (Upload file / Skip for now); No goes straight on |
| /citizenship | Q7 Country of citizenship | Searchable country list (placeholder "Search countries") |
| /income | Q6 Income sources | Multi-select income cards in two groups (see below) |

Continue on /income goes to /income/details (follow-ups, not built yet).

## Stepper sections

The flow is grouped into 5 sections for the stepper (`src/flow/sections.ts`):

| # | Section | Steps |
|---|---|---|
| 1 | About you | Visa type, Enrolled, Years on this visa, State |
| 2 | Tax details | SSN or ITIN, Filed before, Country of citizenship* |
| 3 | Income | Income sources (+ follow-ups) |
| 4 | Documents | Document checklist |
| 5 | Review | Review and submit |

*Placement of Country of citizenship is to confirm (used for the tax-treaty check).
"2 of 3" is shown only for sections with more than one step.

Persistent across the app (old version): bottom tab bar with 3 tabs (Home,
Documents/Scan, Profile), a menu button, and a security/trust badge.

---

## 1. Home
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
**Action:** Continue. Both answers go on to Years on this visa; nothing
branches on it yet.

> ⚠️ **Flag for tax review:** confirm the helper wording, and what (if
> anything) "No" should change: for example, students on OPT after
> graduation are no longer enrolled.

## 3. Q2: Years on this visa (step 2)
**Source:** Designer (no reference screen)
**Question:** "How many years have you been on this visa?"
**Answers (single choice):** "Less than 5 years", "5 years or more"
**Rule:** exactly 5 years counts as "5 years or more".
**"5 years or more" → Continue opens the "We can't file this return" sheet**
(built, `src/flow/ResidentSheet.tsx`). After 5 years they're likely
residents for tax purposes and file Form 1040; AtlasTax only prepares
1040-NR. The sheet doesn't let them continue:
- Title: "We can't file this return for you"
- Body: "With 5 years or more on your visa, you're likely a U.S. resident for
  tax purposes. Residents file Form 1040. AtlasTax only prepares Form 1040-NR,
  for nonresidents."
- "Other ways to file": IRS Free File (irs.gov/freefile) · Free help from
  VITA volunteers (IRS VITA site locator) · A tax professional (ask the
  international student office)
- Action: **Change my answer** (closes the sheet). Close (X) does the same.
**Why we ask:** "To determine residency status for correct tax forms - substantial presence"
**Help link:** "Calculate how long you have been in the U.S."
**Action:** Continue

> ⚠️ **Flag for legal review:** the 5-year boundary decides which forms apply
> (substantial presence test; F-1 students are exempt for 5 calendar years).
> Confirm the wording and the "exactly 5 counts as 5 or more" rule before launch.
> Also confirm the resident sheet's wording, and that the IRS links are the
> right destinations. J-1 non-students (e.g. researchers) follow a different
> rule (2 of the last 6 years), which this question doesn't capture.

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
| Scholarship or fellowship | Did your university withhold any tax from your scholarship? (Yes / No, from the old flow) · Upload your 1042-S, or "I didn't get one" · Did part of it pay for things other than tuition and required fees? **(tax review)** | The old flow already asks about withholding; the 1042-S holds the amounts; the last question only matters if a tax professional confirms it should be asked |
| Freelance | Upload each 1099-NEC, or enter the total you were paid if there's no form · Did you have work-related expenses? **(tax review)** | We need what you were paid; whether expenses can be counted needs confirmation |
| Investments | Upload your brokerage or bank tax form(s) (1042-S or 1099-DIV), or "No form" | The forms list dividends and any tax withheld |
| Trading | Upload your brokerage tax form(s) (1099-B or 1042-S), or "No form" | The forms list sales; nothing else should be asked until we know what's needed **(tax review)** |
| Contract work | Same as Freelance | Same kind of documents |
| No earnings | No follow-up | Nothing to collect |
| Donation | Organization name · Amount · Upload the receipt | The receipt and amount are what any claim would rely on **(tax review)** for whether nonresident filers can use it |
| Child care | Hold: no questions until a tax professional confirms whether and how this applies to nonresident filers **(tax review)** | Avoids asking for information we may not be able to use |

### What's built (v1)

Defaults chosen (to confirm): one question per screen, in income-card order;
uploads can be skipped ("I'll add it later" / "I didn't get one"), to be
collected later in Documents. The old "You selected …" interstitial sheet is
not used. Items marked (tax review) are not built: scholarship costs, freelance
and contract expenses, Donation, Child care.

| Route | Shown when | Question | Answer |
|---|---|---|---|
| /income/bank-form | Bank interest | Did you get a tax form for your bank interest? | Yes / No |
| /income/bank-upload | …and Yes | Upload your bank interest form | Upload · "I'll add it later" |
| /income/bank-amount | …and No | How much bank interest did you earn in {year}? | Amount |
| /income/opt-type | OPT or CPT | Was this work OPT, CPT, or both? | OPT / CPT / Both |
| /income/opt-w2 | OPT or CPT | Upload your W-2 from your OPT or CPT job | Upload · "I'll add it later" |
| /income/campus-w2 | On-campus job | Upload your W-2 from your on-campus job | Upload · "I'll add it later" |
| /income/scholarship-withheld | Scholarship | Did your university withhold tax from your scholarship? | Yes / No |
| /income/scholarship-1042s | Scholarship | Upload your 1042-S for your scholarship | Upload · "I didn't get one" |
| /income/freelance-form | Freelance | Did you get a 1099-NEC for your freelance work? | Yes / No |
| /income/freelance-1099 | …and Yes | Upload your 1099-NEC forms for freelance work | Upload · "I'll add it later" |
| /income/freelance-amount | …and No | How much were you paid for freelance work in {year}? | Amount |
| /income/investments-upload | Investments | Upload your investment tax forms | Upload · "I didn't get a form" |
| /income/trading-upload | Trading | Upload your brokerage tax forms | Upload · "I didn't get a form" |
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
