# AtlasTax flow

Taken from the old screens in `/references`. This covers flow, copy and logic
only. It does not describe visual style.

Old screens showed a numbered progress bar (steps 1 to 7). Steps 2, 3 and 4
have no reference screen. See "Open questions" at the bottom.

## Order at a glance

1. Home
2. Q1: Visa type
3. Q2 to Q4: *(missing, no reference)*
4. Q5: Filed U.S. taxes before? (opens the "Previous return" sheet if Yes)
5. Q6: Income sources (multi-select; each pick opens a follow-up sheet, then follow-up questions such as Scholarship withholding)
6. Q7: Country of citizenship
7. Document checklist (empty, then complete)
8. Review forms
9. Ready to submit

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
**Navigation:** Back arrow

## 3. Q2 to Q4 (steps 2 to 4)
**No reference screens.** Content unknown.

## 4. Q5: Filed before (step 5)
**Source:** `ssn add q.png`
**Question:** "Have you filed U.S. taxes before?"
**Answers:** Not visible (covered by the sheet). Assumed Yes / No.
**Help link:** "Not sure whether you have filed before?"

**Follow-up sheet (shown after answering, assumed after "Yes"):**
- Title: "To continue, we'll ask for your previous tax return."
- Body: "This is optional, but uploading it will save you time and reduce errors."
- Actions: **Skip for now** / **Upload file**
- Close button (X)

Note: the file is named "ssn add q", which suggests an SSN question once
lived here or nearby. Not shown on screen.

## 5. Q6: Income sources (step 6)
**Source:** `Finance picture.jpg`, `job add q.png`
**Question:** "Select the ones that apply to you"
**Answers (multi-select, each with an illustration):**

| Version A (`Finance picture.jpg`) | Version B (`job add q.png`, bottom row visible) |
|---|---|
| Bank Interest | |
| OPT/CPT | |
| On-Campus Job | On-Campus Job (selected) |
| Scholarship | |
| Freelance | |
| Investments | |
| Donation | Trading |
| Contract Work | Contract Work |
| Child Care | No Earnings |

**Action:** Continue

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

## 6. Q7: Country of citizenship (step 7)
**Source:** `treaty.png`
**Question:** "What is your country of citizenship?"
**Answer:** Dropdown, placeholder "Select one"
**Why we ask:** "To automatically check tax-treaty eligibility"
**Help link:** "What is a tax-treaty?"
**Action:** Continue

## 7. Document checklist
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

## 8. Review forms
**Source:** `Document Upload 7.png`
**Title:** "Your Forms Are Ready"
**Subtitle:** "Review your forms to confirm everything is correct before submitting"
**Content:** Preview of the generated Form 1040-NR (U.S. Nonresident Alien Income Tax Return, 2025)
**Actions:** **Submit Forms** / **Review Forms**

## 9. Ready to submit
**Source:** `Document Upload 8.png`
**Title:** "Your forms are ready for submission."
**Body:** "Download, sign, and mail your forms to the IRS."
**Action:** Continue (arrow), presumably to download

---

## Open questions
1. **Steps 2 to 4 are missing.** What were these questions? (Possibly SSN/ITIN,
   days in the U.S., school details.)
2. **Q5 answers:** Yes / No? Does the sheet only appear after Yes?
3. **Q6 options:** Version A or B? (Donation and Child Care vs Trading and No
   Earnings.) Should "No Earnings" clear the other choices?
4. **Q6 follow-ups:** which follow-up questions belong to each income type?
5. **Review screen:** two buttons ("Submit" and "Review") break the
   one-primary-action rule. Which is primary?
6. **Ready screen:** what does the arrow do? Download a PDF, show mailing
   instructions, or both?
7. **Previous years (2024 to 2022):** same flow as 2025?
