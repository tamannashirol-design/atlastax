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
| R2 | Engine core, 2025 | 2025 tables with sources, Tax Table method, wages-only; `check:tax` | Not started | Nothing on screen | Opus |
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
