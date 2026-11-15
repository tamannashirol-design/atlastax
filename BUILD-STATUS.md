# Build status

Last updated: Nov 15, 2026. The visible flow comes first, using the mock reader;
the tax engine follows. Plans: `EXTRACTION-PLAN.md` (consent, reading, review) and
`AFTER-DOCUMENTS-PLAN.md` (estimate, forms, how to pay).

Open the app with `npm run dev`, then http://localhost:5173.

**The tax year is 2025** (`TAX_YEAR` in `src/config.ts`). Earlier years on Home: 2024, 2023.

## Build order

| # | Step | What it builds | Status | What you can see (URL) | Model |
|---|---|---|---|---|---|
| 1 | Masking, field list | Masking helper for SSN, ITIN, EIN, passport (last 4 only); fields per form; `check:extraction` | **Done** (`3aa5026`) | `/styleguide` → "Masked ID numbers" | Opus |
| 2 | Server | Uploads stored privately, checked by content, deletable; consent recorded; `check:server` | **Done** (`1eced11`) | Nothing new on screen; uploads work as before | Opus |
| 3 | Mock reader | Mock provider (10 scenarios), live reading status, Remove deletes on the server | **Done** (`c00e141`) | `/motion` → "Reading (mock)"; `/documents` → Reading, Added, Couldn't read, Try again on cards | Opus, Sonnet for the pills |
| **4** | **Consent sheet** | Notice shown before the first upload; "Continue to upload" / "Not now"; server requires it; read again on Profile; `check:consent` | **Built, waiting for your OK to commit** | `/documents` → **Add** on any card (first time). `/profile` → **Privacy**. `/trips` → open "Fill this in from your I-94 travel history". See "How to see step 4" below. | Sonnet for the sheet, Opus for the logic (see note) |
| 5 | **Reading page** | The page after Continue on Documents: abstract page-line animation, "2 of 3 documents read", per-document status, Try again / Enter it myself, Continue waits when anything failed. `loop.scan` / `loop.sweep` tokens. | Not started (**approved**) | `/reading` (and `?reading=slow` etc. on `/motion`). Documents → **Continue** already points there; until it's built it shows "This screen is coming soon." | Opus for logic, Sonnet for motion |
| 6 | Review screen | One document per screen, ticks on every tax-form or identifying value, "Enter it myself" opens it with empty fields, confirmed-values store on the server | Not started | `/review` (shows "coming soon" today) | Opus for logic, Sonnet for polish |
| R1 | Transcription | Fix the field list to the IRS boxes (1042-S Box 10); turn confirmed values into tax input; `check:taxinput` | Not started | Nothing on screen | Opus |
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

## Step 4: things to know

- **All wording is placeholder** (`src/consent.config.ts`), marked TODO confirm with
  legal. It says only what the prototype does today. The provider's name and the
  retention time say "will be shown here".
- **"Not now" has a consequence** (open question Q-E in `EXTRACTION-PLAN.md`): the
  document stays "not added", and Continue on Documents needs every required
  document. Someone who keeps declining can't pass Documents until we decide how to
  enter details by hand from there.
- **Model note:** this step was written entirely on Sonnet 5.5, including the consent
  logic (`src/consent/logic.ts`, the integration in `UploadAnswer`). It is covered by
  `check:consent` (23 checks), `check:server` (consent cases) and the focus audit
  (131 checks, 0 failed), but I recommend an Opus review pass of that logic.
- The server now requires consent for stored uploads. Measured-only uploads
  (`/motion`, the style guide) are exempt.

## What changed in the order and why

- Original order: 4, 5, 6, then the engine steps. Now: 4, 5, 6 (visible flow, mock
  reader), then **R1, R2, R5, R6** (a first estimate on the result screen, wages
  only; everything else shows "needs review"), then **R3, R4, R7**, then **R8 to R12**.
- Step 5 needs field lists for the **optional** documents (driver's license or state
  ID, previous return), because they are read when added. They go in
  `src/extraction.config.ts`, TODO confirm with CPA.
- Step 6 must support "Enter it myself" with empty fields for one document.
