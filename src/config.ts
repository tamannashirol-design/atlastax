// App-wide settings. Change values here only; never hard-code them in screens.

/**
 * The current tax year. Home's primary action ("Start your 2026 return") and
 * every screen that shows a year use it, unless the person chose a previous
 * year on Home (then that year is used; see useFilingYear in flow/answers).
 * Changed to 2026 by design (was 2025).
 */
export const TAX_YEAR = 2026

/**
 * Earlier years offered on Home as a quiet secondary row. Only years listed
 * here appear; an empty list hides the row. Each runs the same flow.
 */
export const PREVIOUS_TAX_YEARS: number[] = [2025, 2024, 2023]

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
