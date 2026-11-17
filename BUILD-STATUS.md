# Build status

Last updated: Nov 15, 2026. The visible flow comes first, using the mock reader;
the tax engine follows. Plans: `EXTRACTION-PLAN.md` (consent, reading, review) and
`AFTER-DOCUMENTS-PLAN.md` (estimate, forms, how to pay).

Open the app with `npm run dev`, then http://localhost:5173.

**The tax year is 2025** (`TAX_YEAR` in `src/config.ts`). Earlier years on Home: 2024, 2023.

## Build order

| # | Step | What it builds | Status | What you can see (URL) | Model |
|---|---|---|---|---|---|
| 1 | Masking, field list | Masking helper for SSN, ITIN, EIN, passport (last 4 only); fields per form; `check:extraction` | **Done** (`3aa5026`) | `/styleguide` → "Masked ID numbers" (development only) | Opus |
| 2 | Server | Uploads stored privately, checked by content, deletable; consent recorded; `check:server` | **Done** (`1eced11`) | Nothing new on screen; uploads work as before | Opus |
| 3 | Mock reader | Mock provider (10 scenarios), live reading status, Remove deletes on the server | **Done** (`c00e141`) | `/motion` → "Reading (mock)"; `/documents` → Reading, Added, Couldn't read, Try again on cards | Opus, Sonnet for the pills |
| **4** | **Consent sheet** | Notice shown before the first upload; "Continue to upload" / "Not now"; server requires it; read again on Profile; `check:consent`. **Plus the consent review fixes** (below). | **Done** (`5cdf3b4`, review fixes in the commit after it) | `/documents` → **Add** on any card (first time). `/profile` → **Privacy**. `/trips` → open "Fill this in from your I-94 travel history". See "How to see step 4" below. | Sonnet for the sheet, Opus for the logic (reviewed and fixed on Opus) |
| **5** | **Reading page** (redone Nov 15) | One status pill: "Reading your documents" → "Extracting your details" → "Done" (success fill + small settle), each changed only by the mock reader (3–5s per stage); hold 600ms, then Review. Reading starts only when /reading opens (never at upload), every visit reads again. Failures: "Couldn't read" + Try again / Choose another file / Enter it myself, Continue waits. Removed: reading at upload, Reading/Couldn't read on cards, 10s/60s messages, skip-to-Review, minimum display time, Home's "Reading N documents". | **Done** (stall fixed, see below) | `/documents` → **Continue**, or `/reading?reading=normal` / `?reading=fail` | Opus |
| **6** | **Review screen** | "Check your details": one document per screen (passport, I-94, then income), "2 of n", file placeholder left (iPad/laptop) or "View document" sheet (phone), editable fields, tick rule, masked IDs with Show, Confirm and continue (locked, says what's left), Skip for now, summary → "Looks good" → `/result`; saved on the server as you go, resumes; states: needs review, all ticked, couldn't read, wrong document, being read after Replace; `check:review` | **Built, waiting for your "next"** | `/review` after the Reading page; states: `/motion` → "Review" or `/review?review=needs` etc. See "How to see step 6". | Opus |
| **R1** | **Transcription** | Confirmed Review values → `TaxInput` (cents, `buildTaxInput` in `src/tax/input.ts`); only ticked values go in; blockers link to the screen to fix; no ID numbers in the output; 1042-S boxes fixed (Box 10, Box 12d); realistic fake W-2; `check:taxinput` | **Built, waiting for your "next"** | `/motion` → "Tax input (R1)". See "How to see R1". | Sonnet |
| **R6a** | **Result screen (built ahead of the engine)** | `/result`: Federal and State sections ("Estimate (prototype)", refund / amount owed / not calculated / not supported), "Show how we got this", combined total only when both are calculated, notes (single filing status, treaty benefits not included), Download area (both forms "Not ready yet"), R1 blockers with links to fix, "Show estimate number" switch. Reads one interface (`Estimate`, `src/tax/estimate.ts`); R2 now fills in Federal, State is still a placeholder. `check:result` | **Built, waiting for your "next"** | Documents → Review → **Looks good** lands on `/result`; test inputs: `/motion` → "Result (test inputs)". See "How to see /result". | Sonnet |
| **R2** | **Engine core, 2025** (connected to `/result`) | 2025 figures with IRS sources (`src/tax/years/2025.ts`), Tax Table and Tax Computation Worksheet (`src/tax/engine.ts`), the federal estimate for wages only: nonresident, single, no treaty, no deductions yet (`src/tax/federal.ts`); income it can't handle gives no number and a message; refund or amount owed = withholding − tax; runs on the server; `/result` Federal shows it with every line and its IRS page; State still "Not calculated yet"; `check:tax` (all 2,062 Tax Table rows, worksheet, rounding, synthetic cases; official vs mine labelled in the output). Pulled in from R5: nothing new (`POST /api/estimate`, `numbers=0` on the server and the switch already existed). | **Built, waiting for your "next"** | Home → answer the questions → Documents → Continue → Review (tick everything) → **Looks good** → `/result`. See "How to see R2". | Opus |
| **S1** | **State estimate: New York and California, 2025** (connected to `/result`) | Wages only, from the W-2's state (`src/tax/state.ts`, `stateEngine.ts`, figures in `src/tax/years/states-2025.ts`, each with its official source and page). NY: Form IT-201 way (standard deduction $8,000, Tax Table under $65,000, rate schedule from there, household credit). CA: Form 540 way (standard deduction $5,706, Tax Table up to $100,000, Schedule X above, $153 exemption credit). The nine states with no tax on wages (AK FL NV NH SD TN TX WA WY) say "This state has no income tax on wages. No state return needed" with no number; every other state says "State return not supported yet" and shows what was withheld. `check:state` (every row of both states' printed Tax Tables, the schedules, the credit tables, synthetic cases; official vs mine labelled) | **Built, waiting for your "next"** | Review → W-2 → change **State** → `/result`. See "How to see the state estimate". | Opus |
| **T1** | **Student treaty benefits: India and China, 2025** (federal only) | India (Article 21(2)): the standard deduction, $15,750 single, on Form 1040-NR line 12. China (Article 20): up to $5,000 of wages exempt, out of line 1a and shown on line 1k. From the citizenship already given plus a student visa. Figures and conditions from Pub 901 and Pub 519 with the page; the breakdown shows the treaty line; "Treaty benefits aren't included yet." goes away only for India and China (replaced by a note saying what was included and assumed); state numbers unchanged. `src/tax/treaty.ts`, `years/treaties-2025.ts`; `check:treaty` | **Built, waiting for your "next"** | Change citizenship to India or China (`/citizenship`), then `/result`. See "How to see the treaty benefits". | Opus |
| **D1** | **Downloads on `/result`: Form 8843 and Form 1040-NR (2025)** | The official 2025 IRS PDFs, filled on the server from the confirmed values (the treaty lines too: 1k for China, 12 for India with the treaty words in the margin), in memory per click, never saved or logged. Every page (and the added last page) says "Prototype estimate, not for filing"; ID numbers show only their last 4 digits; the last page lists what is left blank, what to check and what isn't included, and so does a disclosure on `/result`. `src/forms/*`, `server/forms.ts`, `POST /api/forms/:id`; `check:forms` | **Built, waiting for your "next"** | `/result` → **Download your forms**. See "How to see the downloads". | Opus |
| **Q1** | **Three questions: lived before, marital status, digital assets** | About you: "Where did you live before coming to the U.S.?" (after citizenship; the India and China treaties now use this, not citizenship) and "What was your marital status at the end of {year}?" (married: no estimate number, says why). Income (last step): "In {year}, did you receive or sell digital assets?" (Yes: no estimate number, says why; fills the 1040-NR's Digital Assets question). "Assumes you lived in India/China" note dropped. Rules: `src/tax/stops.ts`, `src/tax/treaty.ts` | **Built, waiting for your "next"** | `/lived-before`, `/marital`, `/digital-assets`, then `/result`. See "How to see the three questions". | Opus |
| **Q2** | **Names, W-2 address, designee, W-2 wording** | Passport on Review: First name and Last name as two fields (no "name was split" line). W-2 on Review: "Your address" (box f), confirm or edit, used as the 1040-NR home address. Third-party designee: No, not asked. Last page: "Attach Copy B of your W-2 to the front of this form when you mail it." (checked against the 1040-NR instructions, page 23, and Form W-2) | **Built, waiting for your "next"** | Review → passport and W-2 screens; `/result` → Download Form 1040-NR. | Opus |
| **I1** | **Bank interest (1099-INT) and scholarships (1042-S), federal** | Bank interest: exempt for a nonresident (Pub 519 p. 22), shown as a "not taxed" line, not entered on the 1040-NR (instructions p. 19), note "Assumes this is interest from a U.S. bank account." Scholarship: only the taxable part (Pub 519 pp. 24–26; 1040-NR instructions p. 31, line 8r → line 8), box 10 credited on line 25g (p. 22; 1042-S instructions p. 29). New questions "What did your scholarship pay for?" and the living-costs amount. Anything not covered (other income codes, an exemption code, China with a taxable scholarship, tax withheld from interest): no number, says why, TODO confirm with CPA. State: no number with either. `check:income` | **Built, waiting for your "next"** | See "How to see bank interest and scholarships". | Opus |
| **I2** | **Investments (1042-S, 1099-DIV) and trading (1099-B), federal** | Dividends and interest not connected with a U.S. business: the flat 30% (Pub 519 pp. 30–31), Schedule NEC column (c) → line 23a; 1042-S income code and rate used (codes 06, 01; deposit and portfolio interest exempt); box 10 → 25g; 1099-DIV/1099-B box 4 → 25b. Trading: 183-day rule (Pub 519 p. 32; 1040-NR instructions p. 44) with the days from Time in the U.S. Arthur Banks (Pub 519 p. 65) reproduced: $3,125. No number (says why, TODO confirm with CPA): a treaty rate, another code, an exemption code, India/China with taxed dividends or interest, a 1042-S for trading, no cost basis, days missing, 183 days or more (tax home not asked). State: no number. `check:investments` | **Built, waiting for your "next"** | See "How to see investments and trading". | Opus |
| **N1** | **"What to do next" sheet after a download** | After EVERY download on `/result`, a slide-up sheet (same style as the privacy and upload sheets, with the X and a "Done"): 1 Print and sign the 1040-NR · 2 Attach Copy B of your W-2 to the front · 3 Mail it (both addresses from the 1040-NR instructions, pages 12–13) · 4 Pay what you owe (only when owed: irs.gov/payments, or a check with Form 1040-V) · 5 Your refund (only when a refund: no timing). Then an "E-file" button labelled Concept: shows "E-file is coming soon" and does nothing else. Due date shown as upcoming; no late wording. Content in `src/tax/years/filing-2025.ts`, rules in `src/forms/nextSteps.ts`; `check:nextsteps`, `audit:nextsteps` | **Built, waiting for your "next"** | `/result` → **Download**. See "How to see the next-steps sheet". | Sonnet |
| **I3** | **Trading with 183+ days: "where was your main home?"** | One question, asked only with trading income and 183+ days in the U.S. (`src/flow/taxHome.ts`): In the U.S. / Home country. Home country: the gain isn't from U.S. sources (Pub 519 p. 20) so it isn't taxed, same as under 183 days. U.S.: the net gain is taxed at the flat 30% (Pub 519 p. 32), Schedule NEC line 9 column (c) (1040-NR instructions pp. 42 and 44), added to the Schedule NEC tax on line 23a. A treaty country (India/China) with a taxed gain: no number. Unanswered: the estimate waits and links to the question. "Main home" stands in for the tax home: TODO confirm with CPA. | **Built, waiting for your "next"** | See "How to see the trading home question". | Sonnet |
| R5 | Estimate endpoint | `POST /api/estimate`, stale detection, number switch on the server | Not started | Nothing on screen | Opus |
| R6 | Result screen | All states (blocked, refund, owed, zero, needs review, stale), the visible switch that hides the number. **Also replaces the old step 7** (summary and download lock). | Not started | `/result` (`?result=refund` etc.) | Opus for states, Sonnet for UI |
| R3 | Engine: the rest | Scholarships, treaty (from the 1042-S only), India standard deduction, itemized, "needs review" flags | Not started | Nothing on screen | Opus |
| R4 | Test pack, review pack | Every Tax Table row, properties, the review document for the CPA; test output shown | Not started | Test output, one document | Opus, Sonnet for layout |
| R7 | Breakdown | "Show how we got this", assumptions, needs-review tags | Not started | On `/result` | Sonnet |
| R8 | School questions, Form 8843 | New school and program-director questions; the **2025** Form 8843 filled in (IDs last 4 only) | Not started | A new question screen, and a download on `/result` | Opus for mapping, Sonnet for screens |
| R9 | Estimate worksheet | The 1040-NR estimate worksheet PDF, "Estimate (prototype)" on every page | Not started | Download on `/result` | Sonnet |
| R10 | How to pay, state card | Plain payment instructions (no payment details collected); "State return coming soon" | Not started | `/how-to-pay`; the card on `/result` | Sonnet |
| R11 | 2026 | `years/2026.ts` as `draft` until the IRS posts the final form | Not started (later) | Nothing yet | Opus |
| R12 | Audit and copy | Focus audit for Result, contrast pairs, copy review | Not started | All checks | Sonnet |
| 8 | Real provider | A real reading service behind the same interface | Not started (waits on legal and the vendor) | Nothing different on screen | Opus |

Old step 7 (summary, download lock) no longer exists as its own step: it is part of R6.

## Final scope (replaces earlier plans where they conflict)

Review → "Looks good" → `/result` → downloads. The flow ends there. **Not built:**
how-to-pay, the state-return-coming-soon card, deleting documents, treaty logic
(`/result` will say "Treaty benefits aren't included yet."). Order: R1 → R2 (federal
engine, wages first, IRS 2025 figures cited) → state engine (NY, CA) → `/result`
(Federal and State sections, out-of-date on any change) → downloads (official 2025
Form 8843 and 1040-NR, filled, every page marked "Prototype estimate, not for filing")
→ tests. A flaky automated check: investigate once, report, move on.

## How to see /result

1. Real flow: `/documents` → **Continue** → wait for Done → Review. Skip or leave one
   document unconfirmed, then on the summary press **Looks good**: `/result` says
   **We can't give an estimate yet** and lists what's in the way, each with a link
   (**Check your W-2**) and a cobalt **Fix what's missing**.
2. Confirm everything, **Looks good** again: **Your estimate**, with Federal and State
   (New York) each saying **Not calculated yet** and what's missing, and both forms
   **Not ready yet**. (Since R2, Federal shows a real estimate for a W-2-only return: see "How to see R2". State stays **Not calculated yet** until the state step.)
3. Test inputs (made-up numbers, labelled on screen; development only): `/motion` →
   **Result (test inputs)**, or `/result?result=refund`, `owed`, `blocked`, `waiting`.
   Refund and owed show **Show how we got this** and the combined total.
4. The **Show estimate number** switch (top of the page): off removes every amount, and
   the server isn't sent a request for them (`numbers=0`).

## /result: things to know

- **Engine interface:** the page reads only `Estimate`. `estimateReturn()` in
  `src/tax/estimate.ts` fills in `federal` from the engine (R2); the state step will fill
  in `state`; the page won't change. `POST /api/estimate` serves it.
- **Recalculating:** it recalculates every time `/result` opens, and when the answers
  change while it's open (it says "Estimate updated"). Confirmed values change on Review,
  so the new result shows when you come back. There is no separate "out of date" screen
  yet; the number is never shown stale because it is recomputed on load.
- **Privacy:** `/api/estimate` receives a small non-sensitive summary of your documents
  (types and status, visa, citizenship); confirmed values stay on the server and the
  browser stores no amounts. Worth a decision before launch.
- Not built (by your scope): how-to-pay, the state-return card, deleting documents,
  treaty logic.
- The test inputs' numbers are made up, add up (tested), and are not in the production
  bundle.

## Fix: privacy sheet hidden after "Not now"

Bug: "Not now", then Add again: the privacy sheet opened BEHIND the upload sheet, so you
couldn't agree or upload until a reload. Cause: the browser stacks modal dialogs in the
order they open; once the app already knew consent was needed (every attempt after the
first), React opened the inner privacy sheet before the upload sheet around it. Fix:
`BottomSheet` opens a sheet that sits inside another sheet only after the outer one is open,
so it is always on top. The consent record and "no file leaves before agreement" are
untouched. Test: `npm run audit:consent` (dev server running; real clicks: Not now → Add
again → Continue to upload → upload a file, three refusals in a row, Escape, the X).

## How to see the trading home question

1. `npm run dev`. In the questions pick **Trading** with your job and upload any file. Set Time in the U.S. to first arrival **2023**, arrival date **Aug 15, 2023**, no trips (365 days in 2025). After the trading upload comes **In 2025, where was your main home?** ("Where you mainly worked or lived"): **In the U.S.** / **Home country**. (With arrival Aug 15, **2025** (about 139 days) it is not asked.)
2. Review: trading reads as the fake 1099-B (proceeds $5,200, cost basis $4,950: a $250 gain). Tick everything.
3. **Home country** → `/result` Federal **owes $1,193** (as with wages only). "Show how we got this": **Trading gains (not taxed)** $250, "You told us your main home was in your home country, so the gain isn't from U.S. sources."
4. **In the U.S.** (change it at `/income/trading-tax-home`) → **owes $1,268**: **Trading gain (taxed at 30%)** $250 (Schedule NEC line 9, "In the U.S. 365 days in 2025, main home in the U.S."), Tax $4,379, **Tax on trading gain (30%)** $75 (line 23a), Total tax $4,454.
5. State (New York): "We can't include your trading in the state estimate yet."
6. **Download** the 1040-NR: with a U.S. home, line 23a and 23d 75, line 24 4,454, line 37 1,268; the last page says Schedule NEC (with the trading gain) isn't included. With a home-country home, nothing on 23a and a note that trading isn't entered.
7. Checks: `npm run check:investments` (OFFICIAL and MINE labelled; includes when the question is asked) and `check:taxinput` (the blocker).

### Trading home question: things to know

- **Wording shortened:** "In 2025, was your main home in the U.S. or in your home country?" is 4 lines on a phone (3 from 600px), over the 3 and 2 line limits, so the question is "In 2025, where was your main home?" and the two options are the tiles ("In the U.S." / "Home country").
- **"Main home" is not quite the tax home.** Pub 519 (pages 8 and 20) defines the tax home as the main place of work (regardless of where the family home is), or where you regularly live if there's no regular workplace. The helper says "Where you mainly worked or lived" to stay close. TODO confirm with CPA.
- **Not worked out (no number, says why):** a treaty country with a taxed gain; a 1042-S for trading; a 1099-B without cost basis; days not finished. The Pub 519 exceptions on pages 20–21 (inventory, depreciable property, an office or fixed place of business) are not applied.
- **A loss is never taxed** (Pub 519 p. 32), and asking is skipped by the tax-input blocker only when a loss is certain.

### Open: a flaky check (investigated once, not fixed)

`npm run check:server` fails about one run in four on two upload checks ("?dry=1 … not stored" and "refused and partial uploads leave nothing behind"). Cause found: when an upload is refused, `discard()` in `server/storage.ts` destroys the write stream and then deletes the partial file, but the stream may still be opening the file, so an empty `.partial` can be left behind. It affects the data folder only (an empty private file), not what anyone sees. Fix when wanted: wait for the stream to close before deleting.

## How to see the next-steps sheet

1. `npm run dev`; get to `/result` (Documents → Continue → Review, tick everything → **Looks good**).
2. Press **Download** on Form 1040-NR (or Form 8843). The file downloads and **What to do next** slides up. It says "Your 2025 return is due April 15, 2026." (June 15, 2026 if there's no W-2: Instructions for Form 1040-NR (2025), page 12).
3. **Owes** (default, lived in Brazil, $1,193): steps 1 to 3, then **4. Pay what you owe** with a link to irs.gov/payments (and one for people with no U.S. bank account). **Refund** (change "Where did you live before coming to the U.S." to India, `/lived-before`; $697): step 4 is **Your refund** instead, with no timing.
4. Step 3 shows both addresses: not sending a payment (Austin, TX 73301-0215) and sending a payment (P.O. Box 1303, Charlotte, NC 28201-1303), with the page they come from.
5. Press **E-file** (tagged "Concept"): "E-file is coming soon" appears under it. Nothing else happens.
6. Close with the **X**, **Done** or Escape; focus goes back to the Download button. Download again: it opens again (once per download).
7. Checks: `npm run check:nextsteps` (part of the build); `npm run audit:nextsteps` (real clicks, needs `npm run dev`).

### Next-steps sheet: things to know

- **Due dates are in the past as of today (Nov 2026):** the 2025 dates (April 15 and June 15, 2026) have passed. As designed, the sheet shows the date as upcoming and says nothing about filing late. Marked TODO confirm with CPA in `filing-2025.ts`.
- **The forms say "Prototype estimate, not for filing" on every page**, and the sheet tells people to print and mail them. Marked TODO.
- **Form 8843 isn't in the steps.** Its instructions (page 3) say to attach it to the 1040-NR. Marked TODO; add a step if you want it.
- **Which due date:** a W-2 → April 15; none → June 15 (the instructions say "wages subject to U.S. income tax withholding"; a W-2 with $0 in box 2 isn't settled). TODO.
- **Refund step:** the download leaves how you'd like to be paid (lines 35a to 35e) blank, so the step says to fill that in by hand before mailing. No timing is stated (the instructions only give a timing for refunds of tax withheld on a 1042-S).
- **Step 2:** "Copy B" is from the Form W-2 itself; the 1040-NR instructions (page 23) say attach a copy of Forms W-2 and 1042-S to the front, so a line about the 1042-S is added.
- **The sheet appears after the 8843 too**, and when there's no number (steps 1 to 3 only).

## How to see investments and trading

1. `npm run dev`. In the questions pick **Investments** and **Trading** with your job, and upload any file for each. For trading to give a number, the Time in the U.S. answers must come to under 183 days in 2025: first arrival **2025**, arrival date **August 15, 2025**, no trips (about 139 days).
2. Review: the investments document reads as a 1042-S for dividends (FAKE, the Arthur Banks example: income code 06, $1,400, rate 30.00, box 10 $420); trading reads as a 1099-B (proceeds $5,200, cost basis $4,950). Tick everything.
3. `/result` → Federal **owes $1,193**. **Show how we got this**: Dividends (taxed at 30%) $1,400 (Schedule NEC line 1a) · Trading gains (not taxed) $250 ("In the U.S. 139 days in 2025: fewer than 183") · Tax $4,379 · Tax on dividends and interest (30%) $420 (line 23a) · Total tax $4,799 · W-2 withheld $3,186 · Tax withheld on your 1042-S forms $420 (line 25g) · Total payments $3,606.
4. With an arrival in 2023 (365 days in 2025): the trading question is asked (see "How to see the trading home question"); until it's answered the estimate waits and links to it.
5. State (New York): "We can't include your investment income in the state estimate yet."
6. **Download** the 1040-NR: line 23a 420, 23d 420, 24 4,799, 25g 420, 33 3,606; the last page says Schedule NEC isn't included and why trading isn't entered.
7. Checks: `npm run check:investments` (OFFICIAL and MINE labelled).

### Investments and trading: things to know

- **Rates:** only the general 30% is worked out. A 1042-S rate other than 30.00 means a treaty rate: no number. A 1099-DIV shows no rate, so 30% is used with the note "Assumes no tax treaty lowers the 30% rate on your dividends."
- **India and China:** the existing rules are unchanged; with taxed dividends or interest there's no number (their treaties may set lower rates).
- **183-day rule:** the days come from Time in the U.S. (only when every count is answered). Under 183: gains not taxed. 183 or more: the "where was your main home" question decides (I3 below). TODO confirm with CPA: Pub 519 doesn't say whether a student's days count for this rule.
- **Exempt interest on a 1042-S:** deposit interest (code 29, exemption 02) and portfolio interest (code 01, exemption 05), at 00.00: shown, not taxed (Pub 519 p. 22; 1040-NR instructions p. 43).
- **Development fake:** a 1042-S on the investments document now reads as dividends (`FAKE_BY_ITEM` in `server/extraction/fakeValues.ts`); the scholarship 1042-S is unchanged.
- **Line 23a** comes from Schedule NEC line 15 (the form, page 2). Schedule NEC itself isn't in the download yet.

## How to see bank interest and scholarships

1. `npm run dev`. In the questions, pick income **Scholarship or fellowship** and **Bank interest** as well as your job. Bank interest: "Did you get a tax form?" **Yes**, upload any file. Scholarship: upload any file for the 1042-S, then **What did your scholarship pay for?** → **Both**, and **How much of it was for living costs?** → **4000**.
2. Documents → Continue → Review: tick everything on the 1042-S (box 2 $9,000, box 10 $1,260, income code 16, exemption code 00: the IRS's own Example 1) and the 1099-INT ($42.17).
3. `/result` → Federal **owes $413**. **Show how we got this**: Wages $38,450 · Scholarship on your 1042-S $9,000 · Less: tuition, fees and books $5,000 · Taxable scholarship $4,000 (Schedule 1 line 8r → line 8) · Bank interest (not taxed) $42 · Total income $42,450 · Tax $4,859 · W-2 withheld $3,186 · Tax withheld from your scholarship $1,260 (line 25g) · Total payments $4,446 · Amount owed $413. Notes: "Assumes this is interest from a U.S. bank account." and the degree-candidate assumption.
4. Change the answer to **Tuition** (refund $67) or **Living costs** (owes $1,013). Lived in India: the standard deduction comes off wages plus the scholarship (refund $877 with Living costs). Lived in China with a taxable scholarship: no number, says why.
5. State (New York): "We can't include your scholarship in the state estimate yet."
6. **Download** the 1040-NR: line 8 4,000, line 9 42,450, line 25g 1,260, line 33 4,446, line 37 413; lines 2a and 2b empty; the last page says why the bank interest isn't entered, and that Schedule 1 (line 8r) isn't included.
7. Checks: `npm run check:income` (labels OFFICIAL and MINE), plus `check:taxinput` and `check:forms`.

### Bank interest and scholarships: things to know

- **Box 2 is usually already the taxable part.** The 1040-NR instructions (page 31, Example 1) say universities don't have to put tuition, fees and books on the 1042-S. So the answer decides how much of box 2 is taxed: Tuition → none; Living costs → all of box 2; Both → the living-costs amount, never more than box 2.
- **"What did it pay for?" and the amount question were new:** FLOW.md only had a placeholder ("tax review"). Built from your description. Tile descriptions were dropped (they overflowed on a phone) and the helper shortened to keep Continue in place.
- **Assumed and said:** you're a degree candidate (only then can tuition be left out; Pub 519 p. 25), and code 16 means no teaching or research was required for it.
- **No number (TODO confirm with CPA):** a 1042-S income code other than 16; any box 3a exemption code from 01 to 24 (the IRS's Example 2, exempt by treaty, is one); China with a taxable scholarship (the treaty may cover grants: Pub 901 p. 30, not applied); tax withheld from bank interest (1099-INT box 4); bank interest with no form (still "can't include yet").
- **The fake 1042-S changed** to the IRS's Example 1 (box 2 $9,000, box 10 $1,260, code 16, exemption 00). It used to be a treaty-exempt one, which now gives no number.

## How to see the three questions

1. Run `npm run dev`. Start the questions from Home: after **Country of citizenship** comes **Where did you live before coming to the U.S.?** ("Some tax treaties depend on where you lived, not your citizenship"), then **What was your marital status at the end of 2025?** (Single / Married). At the end of Income: **In 2025, did you receive or sell digital assets?** ("Such as crypto or NFTs. Form 1040‑NR asks everyone this"). You can also open `/lived-before`, `/marital`, `/digital-assets` directly to change an answer.
2. With the fake documents confirmed, open `/result`:
   - **Lived in India** (any citizenship), single, No: Federal refund **$697** (the India treaty), no "assumes" note. Lived in China: owes **$593**.
   - **Citizen of India who lived in, say, the U.K.:** no treaty: owes **$1,193**, and "Treaty benefits aren't included yet." stays.
   - **Married:** Federal and State both say **Not calculated yet**, "You were married at the end of 2025. The estimate only works for single filers so far." The 1040-NR download says the same; Form 8843 is still there.
   - **Digital assets Yes:** the same, with "You received or sold digital assets in 2025. The estimate can't include them yet."
   - Digital assets **No**: the downloaded 1040-NR has **No** ticked in Digital Assets.
3. Checks: `check:treaty`, `check:tax`, `check:state`, `check:forms` (all part of the build).

### The three questions: things to know

- **Digital assets wording:** "In 2025, did you receive or sell crypto, NFTs or other digital assets?" runs to 4 lines on a phone (3 from 600px), over the layout limit (3, and 2 from 600px). Shortened to "In 2025, did you receive or sell digital assets?" with crypto and NFTs in the helper. Say if you'd rather keep the long wording.
- **Notes:** "Assumes single filing status." now shows only while marital status isn't answered (older sessions). Once it's answered there's nothing assumed. "Treaty benefits aren't included yet." goes away for anyone who lived in India or China; the treaty line is in the breakdown. So a single student who lived in India sees no notes at all.
- **Treaty:** goes by the country lived in before, never citizenship. Not answered (an older session): no treaty.
- **Married or digital assets Yes:** no federal or New York/California number. No-tax states still say "No state return needed", other states still say "State return not supported yet" with what was withheld.

## How to see the downloads

1. Run `npm run dev`; get to `/result` as before (Documents → Continue → Review, tick everything → **Looks good**).
2. **Download your forms**: **Form 8843** and **Form 1040-NR**, each **Ready** with a **Download** button. Press one: a PDF named `AtlasTax-PROTOTYPE-Form-1040-NR-2025.pdf` (or `…Form-8843-2025.pdf`) is downloaded by the browser.
3. Open it: the official form, filled, with **Prototype estimate, not for filing** across the top and faintly across the middle of EVERY page. 1040-NR (India, fake W-2): line 1a 38,450, line 12 and 14 15,750 with "Standard Deduction Allowed Under U.S.-India Income Tax Treaty" in the margin, line 15 22,700, line 16 2,489, line 25a 3,186, line 34 697. Change citizenship to China (`/citizenship`): line 1a 33,450, **line 1k 5,000**, owes 593 on line 37. Form 8843: name, line 1a "F-1, entered 08/15/2025", line 2 India, days in 2025/2024/2023, line 11 the visa letter, line 12 No.
4. ID numbers: the TIN shows `•••-••-6789`, the passport number `•••••4567`, the 1040-NR identifying number `•••••6789`. Never more than the last 4.
5. The **last page** of each PDF (not part of the IRS form) lists **Left blank**, **Please check**, **Not included**. The same lists are under **What's left blank (N)** on `/result`.
6. **Show estimate number** off: the 1040-NR says **Not ready yet** ("Turn on “Show estimate number” to download this form."): it is made of the amounts. Form 8843 stays.
7. A form that can't be prepared says why (for example "Waiting for the items listed above."; a scholarship 1042-S: the 1040-NR says "We can't include 1042-S in the estimate yet." while Form 8843 stays ready).
8. Checks: `npm run check:forms` (part of the build).

### Downloads: things to know

- **Revisions used:** Form 1040-NR (2025), Cat. No. 11364D, created 9/8/25 (the current file on irs.gov is this same 2025 form). Form 8843 (2025), Cat. No. 17227H, created 6/5/25. **The "current" `irs.gov/pub/irs-pdf/f8843.pdf` is already the 2026 Form 8843** (created 5/11/26): the app's tax year is 2025, so the 2025 file (irs.gov/pub/irs-prior/f8843--2025.pdf) is used. Details and fingerprints: `fixtures/synthetic/irs-blank-forms/README.md`.
- **Where the blank forms live:** `fixtures/synthetic/irs-blank-forms/`. They are public blank forms with no one's information, which fits the existing rule that PDFs live only in `fixtures/synthetic/`. I did NOT change `check:files`. (If you'd rather keep them with the server code, that needs a deliberate exception in `check:files`: your call.) The server checks each file's fingerprint before using it.
- **Not for filing, on purpose:** only the last 4 digits of ID numbers, no signature, no Schedule OI (required with every 1040-NR; item L explains the China exemption on line 1k, and a statement is needed too: 1040-NR instructions page 18), no W-2 attached (the last page says "Attach Copy B of your W-2 to the front of this form when you mail it."), income other than wages isn't included. The form stays fillable, so blanks can be completed by hand.
- **Filled from what's confirmed:** only values you ticked (the same rule as the estimate). The 1040-NR amounts are the page's own estimate lines, never recalculated. Form 8843 line 1a uses the I-94's most recent entry date (the 8843 instructions ask for that), 4a/4b the days counted on the Time in the U.S. screens (4b = all days in 2025 as an exempt student: TODO confirm with CPA), line 11 your current visa letter for each earlier student year, line 12 from the v1 scope rule.
- **Name:** the passport's First name and Last name, two fields confirmed on Review ("Given names", "Surname"). Nothing is split or guessed.
- **Home address (1040-NR):** the W-2's box f ("Employee's address and ZIP code"), a confirm-or-edit field on Review (two lines). Split into street, apt., city, state and ZIP; an address in another shape goes on the street line and the rest is listed blank. "Please check" says it came from the W-2.
- **Third-party designee:** always No (AtlasTax doesn't ask).
- **W-2 wording, checked:** Instructions for Form 1040-NR (2025), page 23, Assemble Your Return: "Attach a copy of Forms W-2 … to the front of Form 1040-NR"; Form W-2 (2025): "Copy B—To Be Filed With Employee's FEDERAL Tax Return".
- **Not asked yet, so left blank and listed:** digital assets (when not answered), school and program director (8843 lines 9, 10), permanent residence (line 13), refund payment details, marital status (Single is assumed).
- **Private:** made in memory per click; `check:forms` proves nothing is written to disk, nothing is logged, and no full ID number (or its middle digits) is anywhere in the file. Dropped from our copy of the IRS file: its XFA copy and Reader-extensions signature (so values show in every viewer).

## How to see the treaty benefits

1. With the same confirmed W-2 as before (wages $38,450, federal withheld $3,186, state New York), open http://localhost:5173/citizenship. Pick **India**, press **Continue** (it moves on to the next question: that's fine), then open http://localhost:5173/result. (Your confirmed documents stay on the server, so nothing needs redoing.)
2. **India:** Federal says **We estimate a refund of $697**. **Show how we got this**: Wages $38,450 → **Standard deduction (India treaty) $15,750** → Taxable income $22,700 → Tax $2,489 → Withheld $3,186 → Refund $697, with Publication 519 pages 39 and 40 on the deduction line. The notes read "Assumes single filing status." and "Includes the India student treaty standard deduction. It assumes you were a resident of India just before you came to the U.S."
3. **China:** go back to `/citizenship`, pick **China**, then `/result`: **We estimate you owe $593**. Breakdown: Wages on your W-2 $38,450 → **Less: treaty exemption (China) $5,000** (Form 1040-NR line 1k, Publication 901 page 30, Publication 519 page 80) → Wages counted $33,450 → Tax $3,779 → Withheld $3,186 → Amount owed $593.
4. **Any other country** (for example France): Federal owes $1,193 as before and both notes stay, including "Treaty benefits aren't included yet."
5. The **State** card is the same for all of them (New York refund $381): the treaty is federal only.
6. **Show estimate number** off removes the treaty amounts too. Checks: `npm run check:treaty` (part of the build).

### Treaty benefits: things to know

- **What decides it:** the citizenship the person gave (India = "IN", China = "CN"; Hong Kong, Taiwan and Macau get nothing: Pub 901 page 2 says the China treaty does not apply to Hong Kong) AND a student visa (F-1, J-1 student, M-1: the questions only continue for students).
- **What it assumes and can't check:** a treaty depends on where the person was a RESIDENT just before coming (India) or on arrival (China), and that they are here (mainly / only) to study. The app asks none of that, so it assumes citizenship = residence. The note on the page and the "Figures used" say so. Also assumed: nobody can claim the person as a dependent (a dependent's India amount is smaller: Pub 519 page 40), and for India no itemized deductions (Pub 519 page 39: "provided you do not claim itemized deductions": itemized deductions aren't built yet, R3).
- **Not enforced (TODO confirm with CPA):** the time limits. Pub 901 says only "a period of time considered reasonable or customarily required" (India) and "only for the time reasonably necessary" (China): no number to apply. Pub 519 page 67 says student limits are "usually 4–5 years"; v1 only prepares a return within the first 5 years as a student anyway.
- **China and OPT/CPT:** the exemption is for a student "present in the United States solely to obtain training, education, or special technical experience". We apply it to all W-2 wages of an F-1 student; whether a particular job (for example OPT after graduation) qualifies is for the CPA to confirm.
- **How the IRS wants it reported (not built):** China: line 1k and Schedule OI item L, plus a statement if no Form 8233 was filed (1040-NR instructions page 18). Form 8833 isn't needed for students (Pub 519 page 68). The downloads aren't built yet.
- **The published figures** were read from Pub 901 (Rev. September 2024, the current revision on irs.gov) and Pub 519 (2025). $15,750 also matches the Form 1040 instructions (page 35).

## How to see the state estimate

1. Same flow as R2 up to the W-2 Review screen (the mock reader's W-2 says **New York**, wages $38,450, state tax withheld $1,893).
2. `/result` → **State: New York**: **We estimate a refund of $381**. **Show how we got this**: Wages $38,450 → Standard deduction $8,000 → Taxable income $30,450 → New York State tax $1,512 (2025 Tax Table) → Household credit $0 → Total $1,512 → Withheld $1,893 → Refund $381, each with its IT-201 line and page, then **Figures used**.
3. To try other states, on the W-2 Review screen type a different two-letter code in **State** (typing clears the tick, so tick **This is correct** again), then **Confirm and continue** → **Looks good**:
   - **CA** → refund $1,374 (tax $672, exemption credit $153).
   - **TX, FL, NV, NH, SD, TN, WA, WY, AK** → "This state has no income tax on wages. No state return needed", no number.
   - **OR** (or any other state) → "State return not supported yet", "Withheld from your pay: $1,893".
4. The state comes from the W-2 (box 15), whatever state the person lives in. Two W-2s from different states, or a W-2 with no state, give no state number and say why.
5. **Show estimate number** off removes every state amount too (also what the server sends, including the withheld amount of an unsupported state).
6. Checks: `npm run check:state` (part of the build).

### State estimate: things to know

- **What it assumes:** wages only, single, not claimed as a dependent, ALL wages earned in the W-2's state. For that case the resident and nonresident forms give the same tax (New York's income percentage is 100%, California's share is 100%), so we use the resident form's lines. New York says a nonresident noncitizen who files 1040-NR may file IT-201 or IT-203 (IT-203 instructions, page 39).
- **Not included, and the number may be off because of it:** **New York City and Yonkers tax** (someone living in the city owes more; the line says so), California's renter's credit and other credits, itemized deductions, State Disability Insurance, other income. The page's two notes are unchanged.
- **No number (says why):** New York adjusted gross income over $107,650 (recapture worksheets), California federal AGI over $252,203 (exemption credit limit), income the engine can't handle (a 1042-S etc.), more than one state, no state on the W-2.
- **NY Tax Table** (tax.ny.gov, tax year 2025) and **CA Tax Table** (booklet pages 69–73) are saved as `fixtures/state/*.json` and every row is tested.
- **No-tax list (2025):** from each state's own revenue site, quoted in `states-2025.ts`, plus the Federation of Tax Administrators table (rates as of Jan 1, 2025: AK FL NV SD TN TX WA WY "No State Income Tax"). **New Hampshire:** its interest and dividends tax was repealed for periods after Dec 31, 2024, and it never taxed W-2 wages (revenue.nh.gov), so it is on the 2025 list. **Tennessee:** the Hall tax ended Jan 1, 2021. **Washington:** no individual income tax in 2025 (the 9.9% tax on income over $1 million starts 2028; the capital gains excise tax is not on wages).
- The NH and TN pages block automated downloads; their wording was read from archived copies of the official pages (web.archive.org) and the Tennessee Hall Income Tax manual. TODO confirm with CPA.

## How to see R2

1. Run `npm run dev`, open http://localhost:5173. The mock reader's fake W-2 is wages
   $38,450, federal tax withheld $3,186 (it reads the same fake values for every file).
2. Home → start the questions (visa F-1, income: **OPT or CPT job** only) → upload any
   file on each upload screen → **Documents → Continue** → wait for **Done** → on each
   Review screen tick every **Please check** box and press **Confirm and continue** →
   **Looks good**. Or after the documents are in, open `/review` and go through it.
3. `/result` → Federal: **We estimate you owe $1,193**. Press **Show how we got this**:
   Wages $38,450 → Taxable income $38,450 → Tax $4,379 (2025 Tax Table, Single column)
   → Federal tax withheld $3,186 → Amount owed $1,193, each with its Form 1040-NR line
   and IRS publication and page, then **Figures used** with the full citations.
4. State (New York) stays **Not calculated yet**. No combined total (needs both).
5. **Show estimate number** off: no amount on the page and none in what the server
   sends. A scholarship (1042-S), freelance or other income card: Federal says **We can't
   include … in the estimate yet** and shows no number. An earlier year (2024, 2023):
   **We can't estimate this tax year yet.**
6. Checks: `npm run check:tax` (part of the build).

### R2: things to know

- **What it assumes (and is wrong about, on purpose, for now):** wages only; single;
  no treaty benefits; **no deductions yet**, so the breakdown shows Deductions $0, "Not
  included yet". A student who could deduct state income tax (Schedule A) or who
  qualifies for the India standard deduction will see a number that is too HIGH until R3.
  The page's notes ("Assumes single filing status.", "Treaty benefits aren't included
  yet.") are unchanged; there is no third note about deductions (the breakdown says it).
- **Tax Table:** computed from the IRS rate table the way the IRS prints it (tax on the
  row's middle amount, rounded); `check:tax` proves it equals ALL 2,062 printed rows
  (`fixtures/irs/tax-table-2025.json`, read from the IRS PDF) and every whole dollar
  from $0 to $99,999. At $100,000 and up: Tax Computation Worksheet, Section A.
- **Official vs mine** (labelled in the `check:tax` output): OFFICIAL = the Tax Table
  rows, the IRS's own example ($25,300–25,350 = $2,801), the rounding examples, and the
  worksheet checked against the amounts printed in Rev. Proc. 2024-40 (the IRS publishes
  no worked example for the worksheet). MINE = the fake W-2, refund, zero withholding,
  even, $120,000, cents, two W-2s, and every "no number" case.
- **Rounding:** cents are added across W-2s first, only the totals are rounded (50 to 99
  cents up), as the Form 1040 instructions say; every amount shown is in whole dollars.
- **Figures** live only in `src/tax/years/2025.ts`, each with publication and page; all
  marked TODO confirm with CPA. `yearConfig()` returns nothing for a year without final
  IRS figures. The signature is `estimateReturn(input)`: the year is in the input.
- **Married people:** Form 1040-NR sends a married nonresident to the "Married filing
  separately" column; in 2025 it gives the same tax as Single, but we don't ask about marital status
  yet (the note says "single"). Revisit with the marital-status question.

## How to see R1

1. `npm run dev`. On `/documents` add passport, I-94 and a W-2, press **Continue**, and on
   Review tick every "This is correct" and **Confirm and continue** on all three.
2. Open http://localhost:5173/motion, scroll to **Tax input (R1)**, press **Show the tax
   input for my return**: "Ready for the engine" and the W-2's numbers (fake: wages
   $38,450.00, federal withheld $3,186.00, state NY, state wages $38,450.00, state tax
   withheld $1,893.00).
3. Before confirming (or after editing a confirmed value, or skipping a document) the same
   button lists what blocks it, e.g. "W-2: not confirmed yet."

## R1: things to know

- **Box numbers checked against the IRS PDFs** (irs.gov/pub/irs-pdf/fw2.pdf and
  f1042s.pdf). Both are the **2026** forms, the only ones online now; the 2025 layout is
  believed identical but was not checked. W-2: a SSN, b EIN, c employer, 1 wages, 2
  federal withheld, 15 state, 16 state wages, 17 state tax: all matched. **1042-S:** two
  errors fixed: the federal credit is **Box 10** "Total withholding credit" (it said 7a),
  and the withholding agent's name is **Box 12d** (it said 12a, which is the EIN). The
  1042-S "country" field is Box 13b "Recipient's country code" (label changed).
- **The state (W-2 box 15) now needs its own tick**, like an amount, because it decides
  the state return.
- **Filing status is assumed single**: there is no marital-status question yet (shown as
  an assumption). Married or dependents will need that question before the number is
  trustworthy. Not built, not in the final scope.
- **The fake W-2 is realistic now** (NY, wages, federal and state withholding), marked
  "(FAKE)" in the employer name and in `server/extraction/fakeValues.ts`. It is NY only:
  CA will be tested with synthetic cases in the engine tests.
- 1042-S and 1099 documents, and self-reported income, are listed as "not read by the
  engine yet" so the engine can say "no number".
- The dev route `POST /api/dev/tax-input` sends a small non-sensitive summary of your
  documents (names of the income types and their status, visa, citizenship) to our
  server and returns amounts for display on `/motion` only. It doesn't exist outside
  development. When `/result` uses this for real, that is a privacy decision to
  confirm (what the browser sends).
- All `check:taxinput` cases are synthetic (mine); R1 is bookkeeping, not tax math.

## How to see step 6

1. `npm run dev`, add passport, I-94 and a W-2 on `/documents`, press **Continue**.
   After "Done" you land on **Check your passport** (1 of 3).
2. Tick each "This is correct" → **Confirm and continue** unlocks → the I-94, then
   the W-2, then **Your details** (summary) → **Looks good** → `/result` (Part 2).
3. Try: **Show** next to the passport number; edit a value (its tick clears);
   **Skip this document for now**; reload (you stay on the same screen).
4. Without uploading: `/review?review=needs`, `ticked`, `failed`, `wrongtype`,
   `replace`, `summary` (also linked on `/motion`).

## Step 6: things to know

- Not on Review yet: optional documents (state ID, previous return) and income
  without a form. The file preview is a placeholder (showing the real file is
  open question Q-B for legal).
- Confirmed values live in server memory only (prototype): restarting the dev
  server forgets them, and the next Review re-reads the document.
- Checks: `check:review` (new, in the build), `check:server` (Review section
  added), focus audit "review" part, `contrast`, build. The earlier stall is
  fixed (below). `check:server` once failed on a slow retry and passed on the
  rerun; it hasn't recurred.

## How to see step 5

1. `npm run dev`, add your documents on `/documents` (passport, I-94, and any income
   forms), then press **Continue**. The page always shows: the pill reads "Reading
   your documents", then "Extracting your details", then "Done" on a green fill;
   about 600ms after it settles you land on Review ("coming soon").
2. Test situations (development only): `/reading?reading=normal`, `fail`, `allfail`,
   `wrongtype`, `blurry`, `rotated`, or `/motion` → **Reading page**.
3. Home after a failure, without uploading: `/?home=readfailed`.
4. Reduce motion on: no loops or slide, same three labels.

## Step 5: things to know

- Checks passing: `check:reading`, `check:server`, `check:files`, `check:consent`,
  `check:documents`, `check:residency`, `check:extraction`, `contrast` (36 pairs,
  two new for the pill), type check.
- Not yet updated for the new flow (docs only): `CLAUDE.md` (Reading page and Documents
  cards sections), `MOTION-reading.md`, `EXTRACTION-PLAN.md`, `FLOW.md`.
- Focus audit: only the Reading part was run after this change; the other sections
  were not re-run.

### Fixed: the "stall" (was: known flaky, Reading part of the focus audit)

- **Cause:** the live reading connection (`/api/extraction/events`) closed and
  reopened on every re-render, because React got a new subscribe function each
  time. The browser allows only a few connections to one server, so other
  requests (ticks on Review, reading updates) queued behind the churn and seemed
  to do nothing. Real users were affected: on Review, "This is correct" stopped
  responding after a click or two.
- **Fix:** one stable subscription per tax year, and the connection closes only
  after 2s with nobody listening (`src/extraction/client.ts`).
- **After:** Reading and Review audits 6 of 6 runs passing; full focus audit
  180 checks, 0 failed; 117 of 117 tick clicks registered across 3 runs.

## How to see step 4

1. Run `npm run dev` and open http://localhost:5173/documents.
2. If you've never agreed in this browser, press **Add** on any card: the sheet opens
   over the upload sheet. If you've agreed already, you won't see it (the agreement is
   remembered per browser).
3. **To see it again:** DevTools → Application → Cookies → `localhost` → delete
   `atlastax_session`, then reload.
4. Try: **Continue to upload** (the upload zone appears and takes focus), **Not now**
   or **Escape** (both sheets close, nothing is uploaded), and dropping a file on a card
   (it waits for you to agree before anything is sent).
5. `/profile` → **Privacy** → **Read the privacy notice** shows the same words,
   read-only, and "You agreed on …" once you have.
6. If the sheet doesn't appear, restart `npm run dev` once (the server code changed).
7. **"The notice has changed"** and **"We couldn't check your privacy settings"** can't
   be produced by hand on your machine (they need a deploy or a broken connection). The
   focus audit plays both: `npm run dev`, then `ONLY=consent npm run audit:focus`.

## Step 4: things to know

- **All wording is placeholder** (`src/consent.config.ts`), marked TODO confirm with
  legal. It says only what the prototype does today. The provider's name and the
  retention time say "will be shown here".
- **"Not now" has a consequence** (open question Q-E in `EXTRACTION-PLAN.md`): the
  document stays "not added", and Continue on Documents needs every required
  document. Someone who keeps declining can't pass Documents until we decide how to
  enter details by hand from there.
- **Model note:** the step was first written on Sonnet 5.5, then reviewed on Opus 5.5;
  the review's findings are fixed (next section).
- The server requires consent for stored uploads. Measured-only uploads (`/motion`,
  the style guide) are exempt, in development only.

## Consent review: what was fixed

| # | Finding | Fix | Tested by |
|---|---|---|---|
| 1 | Agreement could be recorded for words the person didn't see (a tab open across a notice change) | The server sends the words; the sheet shows exactly them; agreeing sends their version + fingerprint; the server records only the current notice, else 409 with the new words → "The notice has changed". The wrong "Check your connection" message is now "We couldn't save your agreement. Try again." | `check:consent` (tab-open case), `check:server` (stale 409, tampered 400, record holds the fingerprint), audit (note gets focus, new words shown, new version sent) |
| 2 | If the status couldn't load, files were sent anyway (and refused uploads were read to the end) | Stored uploads wait until agreement is **confirmed**; "We couldn't check your privacy settings." + Try again. The server answers a refused upload at once and closes the connection. | `check:consent` (offline holds), `check:server` (403 after 64 KB of 5 MB, connection closed), audit (dropped file not sent while the check fails) |
| 3 | "Don't store" test switches were ignored in production (files would be stored) | The server **rejects** them (400) outside development, **and** /styleguide and /motion are left out of production builds | `check:server` (400 for `?dry=1`, `?fail=1`, `?kbps=`, nothing stored), `scripts/check-prod-build.mjs` after every build |
| 4 | A dropped file could be re-sent on a second agreement; "Not now" relied on the opener closing | The dropped file is sent once; "Not now" always closes the sheet | audit (dropped.pdf sent exactly once), `check:consent` ("Not now" wins, also after a refusal) |

**Why both for #3:** hiding the two pages removes the problem for people (nobody can
reach a test upload in production), and the server rejection guarantees it even if
someone sends the request by hand. The cost: the style guide and motion pages can't be
viewed on a deployed preview, only with `npm run dev`.

**File names** (proposal, not built) and **three new legal items** (consent per browser,
re-reading files after a notice change, withdrawal tied to deletion) are in
`EXTRACTION-PLAN.md` §4 and §9.

Checks now: `check:consent` 33, `check:server` all passing (new consent and
production cases), focus audit **146 checks, 0 failed**, production-build check passing.

## What changed in the order and why

- Original order: 4, 5, 6, then the engine steps. Now: 4, 5, 6 (visible flow, mock
  reader), then **R1, R2, R5, R6** (a first estimate on the result screen, wages
  only; everything else shows "needs review"), then **R3, R4, R7**, then **R8 to R12**.
- Step 5 needs field lists for the **optional** documents (driver's license or state
  ID, previous return), because they are read when added. They go in
  `src/extraction.config.ts`, TODO confirm with CPA.
- Step 6 must support "Enter it myself" with empty fields for one document.
