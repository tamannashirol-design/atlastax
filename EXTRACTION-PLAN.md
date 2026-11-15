# Extraction plan

**Status: plan only, waiting for your approval. Nothing built.**

Text extraction means reading the details off each uploaded document (a W-2's
wages, a passport's name and number) so the person doesn't have to type them.
The tool **suggests** the values and the person **confirms every one**.

## 0. Decisions already made

| # | Decision |
|---|---|
| D1 | Extraction only suggests. Every value is confirmed by the person before it's used. |
| D2 | We start with a **mock provider** (fake, scripted results). A real one plugs in later behind the same interface. |
| D3 | A **backend** (server) does the reading. Nothing sensitive is processed in the browser. |
| D4 | Reading starts **right after each upload**, in the background. |
| D5 | Consent and the privacy notice come **before the first upload** (wording needs legal review). |
| D6 | After Continue on Documents, the Reading page appears **only if work is still running**. If everything has been read, the person goes straight to Review. |
| D7 | Progress is real: it changes only when the server reports something. No timers, no fake percentages. |
| D8 | Passport and I-94 are required for everyone, so Review can't offer a download until both exist and are confirmed. |
| D9 | Only fake documents in the repo and tests. SSN, ITIN, passport number and EIN are always masked on screen and never written to logs. |

---

## 1. The big picture

```
 Browser (React app)                 Backend (our server)               Provider
 ───────────────────                 ────────────────────               ────────
 Upload sheet ── file ─────────────▶ /api/files        stores the file
                ◀── fileId ───────── starts reading ──────────────────▶ mock now,
                                                                        real later
 Documents / Reading ◀── events ──── /api/extraction   ◀── results ──── 
 (statuses only)                     keeps suggestions

 Review screen ◀── fields (masked) ─ /api/extraction/…/fields
              ── confirmed values ─▶ saved on the server
```

In plain words:
1. The person uploads a file. It goes to **our** server, which saves it and
   answers with an id (`fileId`). That is the moment reading starts (D4).
2. The server passes the file to the **provider** (the part that does the
   reading). Today that's the mock; later a real service.
3. While it works, the server sends small **events** to the browser
   ("reading W-2", "W-2 ready"). The browser only shows statuses; it never
   reads files itself (D3).
4. On the Review screen the browser asks for the suggested values, shows
   them (ID numbers masked), and sends back what the person confirmed.

### Where things live

| What | Where | Note |
|---|---|---|
| Server code | `server/` (new folder) | A small Node server. In dev, Vite forwards `/api/*` to it, so `npm run dev` still starts everything with one command. |
| Uploaded files | Dev: `.data/files/` (git-ignored). Production: encrypted storage, TBD with legal. | Deleted when the person removes or replaces the file. |
| Suggestions + confirmed values | On the server, per person and tax year | The browser keeps only ids and statuses. |
| Which fields each form has | `src/extraction.config.ts` (new) | A tax rule, so: **TODO confirm with CPA**, and the only place it lives. |
| Masking | `src/lib/mask.ts` (new), used by server and browser | One function; nothing else formats ID numbers. |
| The current dev upload endpoint (`vite.config.ts`) | Replaced by the server's `/api/files` | Keeps the same throttle and `?fail=1` / `?kbps=` test switches, so the folder animation still gets real progress. |

> Today answers are kept in the browser tab (`sessionStorage`). Extracted
> values must **not** go there. The tab keeps only `answers.extraction`
> (ids and statuses, below).

---

## 2. The provider interface (the swappable part)

Every provider, mock or real, looks the same to the rest of the server. Swap
it with one setting (`EXTRACTION_PROVIDER=mock`).

```ts
// server/extraction/provider.ts
interface ExtractionProvider {
  name: string
  /** What it can report. The Reading page adapts to this. */
  capabilities: {
    stages: boolean        // can it say "reading" then "checking"?
    perField: boolean      // does it give a confidence per field?
    forms: string[]        // which forms it knows, e.g. ['W-2', '1042-S', 'Passport']
  }
  /** Read one file. Yields real progress as it happens, then a result. */
  read(input: {
    file: StoredFile
    expectedForm: string   // from documents.config.ts, e.g. "W-2"
    fields: FieldSpec[]    // from extraction.config.ts
  }): AsyncIterable<ProviderEvent>
}

type ProviderEvent =
  | { type: 'stage'; stage: 'reading' | 'checking' }
  | { type: 'result'; fields: ExtractedField[]; detectedForm?: string }
  | { type: 'failed'; reason: 'unreadable' | 'wrong-type' | 'blurry' | 'rotated' | 'other' }
```

**The mock provider** (`server/extraction/mockProvider.ts`):
- Returns fixed fake values per form (from `fixtures/extracted/`), with a mix
  of high- and low-confidence fields so the Review screen shows both.
- Its waits live **inside the fake backend**. The browser never has a timer.
- Scenarios, picked on /motion or with `?reading=`: normal, fast, slow, one
  fails, all fail, wrong type, blurry, rotated, no stages, low confidence.

**A real provider** (a later step, not chosen yet). What we'd check:
1. Knows our forms: W-2, 1042-S, 1099-INT/-NEC/-DIV/-B, passport, I-94.
2. A data agreement: no training on our files, deletion on request, U.S.
   data storage (**legal**).
3. Gives a confidence per field (otherwise every field is "please check").
4. Passport: the machine-readable lines at the bottom have built-in check
   digits, so the number and dates can be verified, not just guessed.
5. Cost per page, and how long it takes (that decides how often people see
   the Reading page).

---

## 3. The data shape

### What the browser keeps (per tax year, in the tab)

```ts
answers.extraction = {
  jobId: string,
  documents: {
    [itemId: string]: {          // 'opt-cpt', 'passport', …
      files: { fileId: string; name: string }[]
      status: 'reading' | 'ready' | 'failed' | 'confirmed'
      failure?: Failure
    }
  }
}
```
No file contents and no values. Upload answers keep their file names as today;
`fileId` is added next to each name.

### What the server keeps, per document

```ts
type ExtractedDocument = {
  itemId: string                // matches documents.config.ts
  form: string                  // "W-2"
  fileIds: string[]
  fields: ExtractedField[]
  confirmedAt?: string          // set when the person confirms this document
}

type ExtractedField = {
  key: string                   // 'wages', 'federalWithheld', 'employerEin'
  label: string                 // plain words, from extraction.config.ts
  box?: string                  // "Box 1", so they can find it on the paper
  kind: 'money' | 'text' | 'date' | 'id' | 'code' | 'country'
  sensitive: boolean            // SSN, ITIN, passport number, EIN → masked
  needsTick: boolean            // goes into a tax form or identifies the person → always ticked (§5)
  suggested: string | null      // what the provider read (null = not found)
  confidence: 'high' | 'low' | 'missing'
  value: string | null          // what the person confirmed or typed
  source: 'suggested' | 'edited' | 'typed'
}
```
- `confidence` is three plain levels. A provider's raw score is turned into
  these on the server; the person never sees a number or percentage.
- A field counts as done only when `value` is set **by the person** (D1).
  Nothing is pre-confirmed.

### Fields per form (`src/extraction.config.ts`, **TODO confirm with CPA**)

Placeholders to show the shape, not a tax decision:

| Form | Fields (placeholder) |
|---|---|
| W-2 | Employer name, Employer EIN, Wages (Box 1), Federal tax withheld (Box 2), State (Box 15), State wages (Box 16), State tax withheld (Box 17) |
| 1042-S | Income code (Box 1), Gross income (Box 2), Exemption code (Box 3a), Tax rate (Box 3b), Federal tax withheld (Box 7a), Withholding agent |
| 1099-INT | Payer, Interest income (Box 1) |
| 1099-NEC | Payer, Payer TIN, Nonemployee compensation (Box 1), Federal tax withheld (Box 4) |
| 1099-DIV / 1099-B | TBD with CPA |
| Passport | Full name, Passport number, Country, Date of birth, Expiration date |
| I-94 | Admission number, Class of admission, Most recent entry date |

### Masking (`src/lib/mask.ts`)

| Kind | Shown as |
|---|---|
| SSN | •••-••-6789 |
| ITIN | •••-••-6789 |
| EIN | ••-•••6789 |
| Passport number | •••••6789 |

- Masked by default everywhere: Review, Home, Documents, live-region
  announcements, error messages.
- On Review, a sensitive field has a "Show" text button (44pt target) that
  reveals it for checking. The full value is fetched only then and not kept
  in the browser after the screen closes.
- Server logs and error reports record **field keys only, never values**.
  A test checks that the fake SSNs in fixtures never show up in log output.

---

## 4. Consent and privacy notice (before the first upload)

- Shown **once per person**, the first time any upload sheet would open
  (income, passport, I-94, previous return, or a card on Documents).
- A bottom sheet: what we do with the documents, who reads them (the
  provider, named), how long they're kept, how to delete them. **All copy
  TODO confirm with legal.** No promises (D5, CLAUDE.md copy rules).
- One primary button ("Continue to upload", wording TBD) and a secondary
  ("Not now", which closes the sheet without uploading). The person can still
  type everything in themselves.
- The server refuses uploads until consent is recorded (date and notice
  version). If the notice changes, people see it again.
- Readable later from Profile.

---

## 5. Review screen ("Check your details")

The confirmation screen, in the **Review** section of the stepper.

### Structure
- **One document per screen** (W-2, then 1042-S, …, then Passport, I-94),
  so each screen has one job and one Continue. The stepper shows "x of n"
  through `positionOf()`, counting the documents this person has.
- The order follows `requiredItems(answers)`: income documents first, then
  identity documents.
- Self-reported income (no form) gets the same screen with empty fields to
  type in. "Enter it myself" for a failed document uses it too.

### One document screen

```
  Check your W-2                                   ← headline
  From Acme Corp. Check each detail against        ← muted helper
  your form.                                       

  [ View your file ]                               ← text button, opens the file in a sheet

  ┌───────────────────────────────────────────┐
  │ Wages · Box 1                              │
  │ [ $ 24,180.00                         ]    │   ← prefilled field, editable
  ├───────────────────────────────────────────┤
  │ Employer EIN                               │
  │ [ ••-•••6789                   ] Show      │   ← masked
  ├───────────────────────────────────────────┤
  │ ⚠ Please check: Federal tax withheld       │   ← low confidence: icon + text, not color alone
  │ [ $ 2,0?6.00                          ]    │
  │ [ ] This is correct                        │   ← must be ticked or edited
  ├───────────────────────────────────────────┤
  │ State tax withheld · Box 17                │
  │ [                                     ]    │   ← missing: empty, "We couldn't find this"
  └───────────────────────────────────────────┘

  [ These details are correct ]                    ← the one cobalt button
```

### How confirming works (decided, Q-A)
- **Always ticked:** every value that goes into a tax form or identifies the
  person needs its own tick ("This is correct"), **whatever the confidence**:
  money amounts (wages, withholding, income), ID numbers (SSN or ITIN,
  passport number, EIN, admission number), names and dates. Which fields
  these are is set per field in `extraction.config.ts` (`needsTick: true`),
  never decided by a component.
- **Other details** (e.g. state, payer address) need a tick only when
  flagged "Please check" (low confidence). Clear ones are confirmed by the
  document's main button, since the person has seen them on the screen.
- Editing a field counts as confirming it.
- **Missing** fields must be typed (or marked "Not on my form", where the
  config allows it).
- The button stays locked until every field has a value from the person. The
  disabled label stays readable (3:1). A short line under it says what's
  left ("1 detail to check").
- Editing a field marks it `edited`. Changing a confirmed document later
  (or replacing its file) clears its confirmation.

### After the last document
- A summary screen: each document with "Confirmed" and an "Edit" link.
- The **download is offered only** when every required document is confirmed,
  including passport and I-94 (D8). Otherwise the screen names what's
  missing and links to it. (Building the return itself is a separate plan.)

### States to cover
Loading (fields arriving), all high, some low, missing fields, a document that
failed ("Enter it myself"), a replaced file (re-read, back to "Reading"), and
going back to an already confirmed document.

---

## 6. Changing or removing files

| What the person does | What happens |
|---|---|
| Adds another file to a document | That document is read again with all its files; its fields are refreshed and its confirmation is cleared. |
| Replaces a file | Same, and the old file is deleted from the server. |
| Removes a file (existing "Remove" sheet) | Deleted from the server; reading for it stops. If it was the last file, the document goes back to "not added". |
| Removes a whole document's income in the questions | Its files and suggestions are deleted. |

---

## 7. Fake documents and tests

- Test documents live in `fixtures/synthetic/`, each clearly marked SAMPLE.
  SSNs and ITINs use only the allowed fake values (123-45-6789, 000-00-0000,
  111-11-1111, 555-55-5555); EINs and passport numbers are made up.
- **Built:** `npm run check:files` (runs before every build) fails if a PDF
  sits anywhere but `fixtures/synthetic/`, if an image sits outside it or
  the design folders, or if any text file has an SSN-like number other than
  the allowed fake ones. A later step extends it to EIN and passport shapes.
- The three broken PDFs that were in the project root (filler from upload
  tests) were deleted.
- `npm run check:extraction` (new) tests masking, confidence levels, the
  "every field confirmed" rule and the D8 download lock.
- `npm run audit:focus` gets Reading and Review parts.

---

## 8. Build order (small steps, each one you can look at)

| Step | What | What you'll see | Model |
|---|---|---|---|
| 1 ✓ | Masking helper, fixture check, field config (`npm run check:extraction`) | `/styleguide` → "Masked ID numbers" | Opus |
| 2 | Server skeleton, `/api/files` replaces the dev endpoint, consent recorded | Uploads still animate exactly as before | Opus |
| 3 | Mock provider, jobs and events, `answers.extraction` | A "Reading" pill on Documents cards; scenarios on /motion | Opus, then Sonnet for the pill |
| 4 | Consent sheet (placeholder copy) | Appears before the first upload | Sonnet |
| 5 | Reading page (section below) | `/reading?reading=slow` etc. | Opus for logic, Sonnet for motion |
| 6 | Review screen | One screen per document, all states via `?review=` | Opus for logic, Sonnet for polish |
| 7 | Summary + download lock (D8) | Locked until passport and I-94 confirmed | Opus |
| 8 | Real provider adapter | After legal and the vendor choice | Opus |

Each step ends with `npm run contrast`, the new checks, and new color pairs in
`src/tokens/pairs.ts`.

---

## 9. Open questions

**For you**
- ~~Q-A.~~ **Decided:** a tick on every tax-form or identifying value,
  whatever the confidence; other details only when flagged (§5).
- **Q-B.** "View your file" next to the fields on Review: OK to show the
  person their own document there? (It helps checking; it's their file.)
- **Q-C.** On laptop, the file and the fields side by side (7/5 columns)?
- **Q-D.** A document that **failed while they were away**: go to Review and
  offer "Enter it myself" there, or stop on the Reading page to offer "Try
  again" first? (Reading-page Q4 below.)
- **Q-E.** Consent "Not now": keep the person in the flow typing things in
  themselves, or is uploading required?
- ~~Q-F.~~ **Settled:** the three PDFs were broken filler; deleted.

**For the CPA** (add to the list): which fields to collect per form; 1099-DIV
and 1099-B fields; which fields may be "Not on my form".

**For legal** (add to the list): consent and privacy wording, how long files
and values are kept, the provider's data agreement, whether showing the
document back on Review is fine.

---

## Reading page

(Inside this part, "§1" to "§10" mean its own numbered sections below.)

**Status: planned, not built. Waiting for your approval.** Motion study:
`MOTION-reading.md` (also waiting for your OK).

### Flow

```
Documents ── Continue ──┬── still reading ──▶ Reading page (/reading) ──▶ Review
                        └── all read ───────────────────────────────────▶ Review
```

- Reading starts after each upload (D4), so by the time someone presses
  Continue it's often finished. The Reading page appears **only if something
  is still being read** (D6). Since Continue needs every required document,
  everyone who gets here has at least passport and I-94 (Q1 settled).
- What gets read: every document with status "added" from
  `requiredItems(answers)`. The rules stay in `documents.config.ts`; the page
  never decides which forms matter. Optional documents are a question (Q6).
- Address: `/reading`. Opened from Documents' Continue, from Home while a job
  is running, and by typing it. With no job and nothing added, it redirects
  to Documents.
- Stepper: it belongs to the **Review** section (Documents ✓, Review
  current) but isn't a counted step, like the upload sheets. `positionOf()`
  skips it.
- Back arrow → Documents. "Save and exit" → Home. **Neither cancels the
  job**: reading carries on (same as "Keep going in the background").

### What the page gets from the server

The browser doesn't talk to the provider (§2); it talks to our server through
a small client, `src/extraction/client.ts`. Jobs start on upload (D4), so the
page never starts one; it only listens.

```ts
type Stage = 'queued' | 'reading' | 'checking'
type Failure = 'unreadable' | 'wrong-type' | 'blurry' | 'rotated' | 'other'

interface ExtractionClient {
  /** Copied from the provider, decides how fine the page's statuses are */
  capabilities: { stages: boolean }            // false → only "started" / "result" per document
  /** Real job events (server-sent events). The page changes a status ONLY when one arrives. */
  subscribe(jobId: string, on: (e: JobEvent) => void): () => void
  /** Current state, for returning to the page later (Home, reload) */
  get(jobId: string): Promise<JobSnapshot>
  retry(jobId: string, itemId: string): Promise<void>
}

type JobEvent =
  | { type: 'stage'; itemId: string; stage: Stage }
  | { type: 'ready'; itemId: string }                         // fields go to the review screen
  | { type: 'failed'; itemId: string; reason: Failure; expected?: string }
  | { type: 'complete' }                                      // every document has a result
```

- The job id is saved with the year's answers (`answers.extraction`, §3),
  so Home, Documents and a reload can find it. No file contents and no
  extracted values are stored there.
- The mock provider (`server/extraction/mockProvider.ts`) sends these same
  events on its own schedule. Its timers belong to the **fake backend**; the
  page itself has no progress timers.

### 1. Layout

The existing question-template shell (`QuestionLayout`, auto-height answer
area like the Income question), so it sits in the same frame as every other
step: top bar, compact stepper below 1024px, rail at 1024px+.

```
  Reading your documents                          ← headline (question style)
  You'll check everything before it's used.       ← one calm sentence (Body, muted)

  ┌──────────────────────────────┐
  │   [ illustration: hero ]     │                 ← decorative, aria-hidden
  └──────────────────────────────┘

  W-2                    ◌ Reading                ← real list, one row per document
  1042-S                 ✓ Ready to review
  Passport               ◷ Uploaded
  …
                                                   ← Continue only when needed (§4)
```

- **Hero** (rebuilt from our tokens, no literal objects): a white surface
  card (radius lg, `--shadow-1`, hairline `border-decorative`) showing a few
  quiet `sage-100` lines like a page. A small 5×5 grid of navy dots in the
  corner carries the reference's scan (`loop.scan`), and a soft light band
  moves across the lines (`loop.sweep`). When a document is ready, the check
  draws in with the `success` token on the card (no saturated fill, no thick
  rim). It's 4pt grid and flex only, centered in the content columns, and the
  same height in every state so nothing below it moves.
- **Document rows**: `<ul>` with one `<li>` per document. Each row is 56pt
  tall (the file-row height): the form name (Body, semibold) on the left and
  the status as **icon + text** (Small) on the right, never color alone:

  | Status | Text | Icon (Phosphor regular, 24) | Color |
  |---|---|---|---|
  | Waiting its turn | Uploaded | `FileArrowUp` | text-muted |
  | Being read | Reading | 3×3 dot grid (tiny `loop.scan`) | text |
  | Being checked | Checking | `ListChecks` | text |
  | Done | Ready to review | `CheckCircle` | success |
  | Failed | Couldn't read | `WarningCircle` | error |

  The icons get their reasons on /styleguide, and their color pairs go in
  `pairs.ts`.
- One primary action at most (§4); on the normal path there's none at all,
  because the page moves on by itself (§5).

### 2. Progress is real

- A row changes **only** when its event arrives: `stage` → Reading or
  Checking, `ready` → Ready to review, `failed` → Couldn't read.
- If `capabilities.stages` is false: rows go Uploaded → Reading (when that
  document starts) → result. There's no "Checking" step, and the scan loop
  keeps going in between. It's an indeterminate loop, never a guess.
- **No percentages, no progress bar, no "x seconds left", no timer-driven
  status.** A count of finished documents ("2 of 3 ready") is allowed
  because each tick is a real event (see Q3).
- The loops (`loop.scan`, `loop.sweep`) run only while at least one document
  is Reading or Checking, and stop when the last result arrives.

### 3. Timing thresholds

These use elapsed time only to **change the words**, never the progress.

| After | What appears | Where |
|---|---|---|
| ~10s with no result yet | "Still working. This can take a moment." | Replaces the supporting sentence (cross-fade, `quick`); also announced politely |
| ~60s | "Keep going in the background" (secondary button) | Under the list |

**In the background:**
- "Keep going in the background" goes to Home. The job keeps running.
- **Home** gets a new state from `returnStatus()`, **"reading"**:
  - Hero: "Reading 3 documents", with "You'll check everything before it's used."
  - Cobalt button: **"See progress"** → `/reading`.
  - When the job finishes while away, Home shows **"Ready to review"** →
    the review screen (or "1 document couldn't be read" → `/reading`).
- **Documents page**: each card being read shows a **"Reading"** pill in
  the same top-right spot as "Added" (that space is already reserved, so
  cards don't change size), with a small dot icon and text. Its Add/Replace
  is disabled while reading. When that document finishes, the pill becomes
  "Added".
- **How a person gets back:**
  1. Home's "See progress"
  2. Any "Reading" card on Documents (the card links to `/reading`)
  3. Typing `/reading`, or a reload: the page reattaches with `get(jobId)`,
     then `subscribe`
  4. The stepper's Review section

  If it finished while they were away, `/reading` shows the final list for
  a moment (§5) and moves on, or shows the failures (§4).

### 4. Failures

- One document failing **never blocks the others**. They keep going and
  reach "Ready to review".
- A failed row expands under its name with a plain message and two buttons:
  **"Try again"** (secondary) and **"Enter it myself"** (text button).
  - Try again → `retry()`, and the row goes back to Reading on the next event.
  - Enter it myself → that document goes to the review screen with empty
    fields to type in.
- Messages (copy, see §6):

  | Reason | Message | First button |
  |---|---|---|
  | unreadable / other | "We couldn't read this one." | Try again |
  | wrong-type | "This doesn't look like a W-2." (the expected form's name, from the rules) | **Choose another file** (opens the upload sheet), not Try again |
  | blurry | "This photo is too blurry to read. A sharper photo in good light can help." | Choose another file |
  | rotated | "This photo is sideways or upside down. Try one that's upright." | Choose another file |

- When **every** document has a result and at least one failed, the page
  **doesn't move on by itself**. It shows **Continue** (the one cobalt
  element), which goes to the review screen for the documents that worked.
  Failed ones are listed there as "Enter it myself" (see Q4).
- All failed: "We couldn't read your documents." Each row has its own
  actions, and Continue becomes "Enter them myself".

### 5. Completion

- Every document has a result and none failed → go to the review screen
  automatically.
- **No flash:** keep the page up for at least ~1.5s in total, and show the
  final state (all rows "Ready to review", the hero's check drawn) for at
  least ~700ms before leaving. With the mock's fast mode, the whole thing
  still reads as "it worked".
- Leaving: a page transition with `quick`, then focus on the review screen's
  heading (§8).

### 6. Copy (plain and warm)

| Where | Text |
|---|---|
| Headline | Reading your documents |
| Supporting sentence | You'll check everything before it's used. |
| After ~10s | Still working. This can take a moment. |
| After ~60s (button) | Keep going in the background |
| Home, while reading | Reading 3 documents |
| Home, done while away | Ready to review |
| Row statuses | Uploaded · Reading · Checking · Ready to review · Couldn't read |
| Failures | see §4 |

- No promises about accuracy, speed, savings, or what happens to the files.
  No time estimates.
- If we ever add a line about file handling ("Your files are…"), it's
  **TODO confirm** and comes from `PRIVACY_LINE`, never written here.
- "Picking out the details" or similar wording describes the job without
  promising a result. Reading words are kept factual: "reading", "checking".

### 7. Motion

Detail and measurements: `MOTION-reading.md`. In short:

| Moment | Token |
|---|---|
| Row status text changes | old text out with `fade`, new text in with `quick` (opacity + 4px slide) |
| Row icon changes | `quick`, starting 100ms after the text (the reference's trail) |
| Supporting sentence swaps (10s line) | `quick` cross-fade |
| Hero scan (dot grid) | **new `loop.scan`**: 1.6s, 4 steps, repeating, opacity only |
| Hero sweep (light band over the page lines) | **new `loop.sweep`**: 2.0s cycle, transform (translateX) only |
| A document becomes ready | the hero's check draws in: `pop` (Q7) or `soft` |
| Final state settles | `soft` |

- Transform and opacity only. Colors switch by fading layers. Everything can
  be interrupted: a new event cancels whatever is running.
- **Reduced motion:** no movement. The hero is a still card (no scan, no
  sweep), statuses swap with `fade`, the text is identical, and the live
  region still announces.

### 8. Accessibility

- **Live region** (polite, one per page): "Reading your W-2", "Checking your
  W-2", "W-2 ready to review", "Couldn't read your 1042-S", "Still working.
  This can take a moment." Only on real changes, never on loop ticks. Several
  at once are queued, not stacked.
- The document list is a real `<ul>`, and each row's status is part of its
  text (no `aria-label` replacing what's visible).
- **Focus:**
  - On load, the headline (like every question screen).
  - When a row fails, focus stays put. The live region speaks, and the new
    buttons are reachable in normal tab order.
  - "Try again" moves focus back to that row.
  - On completion, the review screen's heading.
  - After "Keep going in the background", Home's heading.
- Everything works by keyboard: Try again, Choose another file, Enter it
  myself, Continue, Keep going in the background. 44pt targets.
- The hero animation is decorative: `aria-hidden`, nothing in it to read.
- Contrast: every new pair registered in `src/tokens/pairs.ts`. The label is
  never dimmed by the sweep (`MOTION-reading.md`, "What we drop").
- `npm run audit:focus` gets a Reading part: load, a failure, Try again,
  completion, background.

### 9. Testing switches (/motion)

A "Reading page" panel on /motion drives the **mock provider**:

| Switch | What the mock does |
|---|---|
| Normal | A few seconds per document, with stages |
| Fast | Every result within ~1s (tests the no-flash hold) |
| Slow | Past 10s and 60s (tests both thresholds and the background path) |
| One fails | One document `unreadable`, the rest ready |
| All fail | Every document fails |
| Wrong type | One document `wrong-type` |
| Blurry / Rotated | One document each |
| No stages | `capabilities.stages = false` (Uploaded → Reading → result) |
| Reduced motion | Same as the existing /motion toggle |

Also `?reading=slow|fast|fail|allfail|wrongtype` on `/reading` itself, like
`?home=`, plus a `?home=reading` fixture.

### 10. Open questions for you

1. ~~Deferring everything vs locked Continue.~~ **Settled:** Continue needs
   every required document; Reading appears only while something is still
   being read (D6).
2. ~~When does reading start?~~ **Settled:** right after each upload (D4).
3. **A count in the hero**, such as "2 of 3 ready"? It's event-based (not a
   percentage), but it's still a number.
4. **With failures**, wait for Continue (my proposal), or move to the review
   screen automatically and handle failed documents there?
5. **What the animation needs to show "reading" truthfully:**
   - Does the provider say **which document is being read right now**? If
     yes, the hero can name it ("Reading your W-2") and change when the
     next one starts. If documents are read in parallel or it can't say,
     the hero shows a generic "reading" loop and the list carries the
     detail.
   - Does it report **stages** (reading → checking)? If not, there's no
     "Checking" anywhere.
   - Can it report **per-page or per-field** progress? If not, the scan stays
     an indeterminate loop. It must never look like it's moving along a page
     it isn't reading.
   - Should the hero show the person's **actual document** (a blurred
     thumbnail) or stay abstract (page lines)? Abstract is safer for privacy
     and avoids showing something we aren't really scanning line by line.
     I recommend abstract.
6. **Optional documents** (driver's license, previous return): read them
   too, or only the required ones?
7. **The check**: reuse `pop` (CLAUDE.md reserves it for the upload check),
   or keep the reading check calmer on `soft`?
8. **The two new loop tokens** (`loop.scan`, `loop.sweep`): OK to add a
   `loop` group to `src/lib/motion.ts`?
9. **Notifications** when it finishes in the background (email, browser)?
   Out of scope for now unless you want them.
10. **"Enter it myself"** depends on the review screen supporting empty
    fields for one document. Confirm that's in its plan.
