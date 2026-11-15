// App-wide settings. Change values here only; never hard-code them in screens.

/**
 * The current tax year. Home's primary action ("Start your 2025 return") and
 * every screen that shows a year use it, unless the person chose a previous
 * year on Home (then that year is used; see useFilingYear in flow/answers).
 * 2025 by design: the first tax year the estimate is built and verified for
 * (AFTER-DOCUMENTS-PLAN.md). The IRS has no final 2026 form yet. Never type a
 * year anywhere else: read this, or the filing year.
 */
export const TAX_YEAR = 2025

/**
 * Does /result show the estimate number by default? The person can turn it off with the visible
 * "Show estimate number" switch on /result (this browser only). Off: no amount anywhere, and the
 * server doesn't send any. Never on Home or in marketing.
 */
export const ESTIMATE_NUMBER_VISIBLE = true

/**
 * Earlier years offered on Home as a quiet secondary row. Only years listed
 * here appear; an empty list hides the row. Each runs the same flow.
 */
export const PREVIOUS_TAX_YEARS: number[] = [2024, 2023]

/**
 * One privacy line on Home, under the actions. Empty = not shown.
 * TODO confirm: leave empty until design/legal confirm what we can promise.
 */
export const PRIVACY_LINE = ''

/**
 * Income-card illustrations: the designer's own files (provided for use), so
 * they're on. Set to false to fall back to quiet placeholders; ?art=1 previews.
 */
export const ILLUSTRATIONS_APPROVED = true

/**
 * Largest file a person can upload (checked in the browser first, and again
 * by the server). TODO confirm: design + the extraction provider's limit.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
