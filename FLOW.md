# AtlasTax flow

Taken from the old screens in `/references`, plus answers from the designer.
This covers flow, copy and logic only. It does not describe visual style.

Every question screen (steps 1 to 7) uses the same layout: progress (step X
of 7), back, question, answer options, "why we ask" helper line, an optional
help link, and Continue.

## Order at a glance

1. Home
2. Q1: Visa type
3. Q2: Years on this visa
4. Q3: State
5. Q4: SSN / ITIN
6. Q5: Filed U.S. taxes before? (opens the "Previous return" sheet)
7. Q6: Income sources (multi-select; each pick opens a follow-up sheet, then follow-up questions such as Scholarship withholding)
8. Q7: Country of citizenship
9. Document checklist (empty, then complete)
10. Review forms
11. Ready to submit

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

**Next:** File for 2025 → Q1.

## 2. Q1: Visa type (step 1)
**Source:** `Visa.png`
**Question:** "What is your visa type?"
**Answers (single choice):** F-1, J-1, M-1
**Why we ask:** "To personalize the experience and show only visa-relevant forms"
**Help link:** "Not sure about your visa type?"
**Action:** Continue (disabled until an answer is picked)

## 3. Q2: Years on this visa (step 2)
**Source:** Designer (no reference screen)
**Question:** "How many years have you been on this visa?"
**Answers (single choice):** <5, 5> (read as "Less than 5" and "5 or more")
**Why we ask:** "To determine residency status for correct tax forms - substantial presence"
**Help link:** "Calculate how long you have been in the U.S."
**Action:** Continue

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
**Answers:** Not visible (covered by the sheet). Assumed Yes / No.
**Help link:** "Not sure whether you have filed before?"

**Follow-up sheet (shown after answering, assumed after "Yes"):**
- Title: "To continue, we'll ask for your previous tax return."
- Body: "This is optional, but uploading it will save you time and reduce errors."
- Actions: **Skip for now** / **Upload file**
- Close button (X)

## 7. Q6: Income sources (step 6)
**Source:** `Finance picture.jpg` (version A), `job add q.png` (version B)
**Question:** "Select the ones that apply to you"
**Answers (multi-select, each with an illustration). Merged list from both versions:**

1. Bank Interest
2. OPT/CPT
3. On-Campus Job
4. Scholarship
5. Freelance
6. Investments
7. Trading *(version B only)*
8. Contract Work
9. Donation *(version A only)*
10. Child Care *(version A only)*
11. No Earnings *(version B only)*

**Action:** Continue

### What differs between the two versions (to confirm)
- Only the bottom row of the grid differs:
  - Version A: Donation, Contract Work, Child Care
  - Version B: Trading, Contract Work, No Earnings
- In version B, the sheet covers the top two rows, so we're assuming they
  match version A.
- **Donation and Child Care aren't income.** They're deductions and credits.
  That may be why version B replaced them. If we keep them, they may belong
  on a separate "expenses" question.
- **Trading and Investments overlap.** Should they be one option, or two
  separate ones?
- **No Earnings is an "opt-out" option.** If it's kept, picking it should
  clear the other picks, and vice versa.

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
**Action:** Continue (arrow), presumably to download

---

## Open questions
1. **Q2 boundary:** does exactly 5 years count as "5 or more"? (This matters
   for the substantial presence test, where F-1 students are exempt for 5
   calendar years.) Also, should the labels read "Less than 5" / "5 or more"
   instead of "<5" / "5>"?
2. **Q5 answers:** Yes / No? Does the sheet only appear after Yes?
3. **Q6 options:** confirm the merged list. See "What differs" above.
4. **Q6 follow-ups:** which follow-up questions belong to each income type?
5. **Ready screen:** what does the arrow do? Download a PDF, show mailing
   instructions, or both?
6. **Previous years (2024 to 2022):** same flow as 2025?
