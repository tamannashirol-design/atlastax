# Official blank IRS forms

The two BLANK official forms the downloads on /result are filled from. They are public IRS forms with no one's
information in them (so they fit the rule that PDFs live only in `fixtures/synthetic/`: nothing real or personal
is here). The server fills a copy in memory, per request, and never saves or logs the result.
`src/forms/templates.ts` pins each file's fingerprint (SHA-256) and the server refuses a file that differs.

| File | Form | Revision | Source (fetched Nov 16, 2026) |
|---|---|---|---|
| `f1040nr--2025.pdf` | Form 1040-NR, U.S. Nonresident Alien Income Tax Return | **2025**, Cat. No. 11364D, "Created 9/8/25" (the current file at irs.gov/pub/irs-pdf/f1040nr.pdf is this same 2025 file) | https://www.irs.gov/pub/irs-prior/f1040nr--2025.pdf |
| `f8843--2025.pdf` | Form 8843, Statement for Exempt Individuals and Individuals With a Medical Condition (includes the instructions, pages 3 and 4) | **2025**, Cat. No. 17227H, "Created 6/5/25" | https://www.irs.gov/pub/irs-prior/f8843--2025.pdf |

NOTE: the *current* `irs.gov/pub/irs-pdf/f8843.pdf` is already the **2026** Form 8843 (Cat. No. 17227H, "Created
5/11/26"). The app's tax year is 2025 (`TAX_YEAR` in `src/config.ts`), so the 2025 revision is used.

To change the year: add the new year's two forms here, add their fingerprints to `src/forms/templates.ts`, and
re-check every field name in `src/forms/map-*.ts` (the IRS renumbers fields between years).
