// App-wide settings. Change values here only; never hard-code them in screens.

/**
 * The tax year being filed. Used by the stepper rail header, Home
 * ("File for 2025"), forms, deadlines, and anywhere else a year appears.
 * Confirmed by design: keep 2025.
 */
export const TAX_YEAR = 2025

/** Earlier years offered on Home under "File for previous years". */
export const PREVIOUS_TAX_YEARS = [TAX_YEAR - 1, TAX_YEAR - 2, TAX_YEAR - 3]

/**
 * Income-card illustrations: the designer's own files (provided for use), so
 * they're on. Set to false to fall back to quiet placeholders; ?art=1 previews.
 */
export const ILLUSTRATIONS_APPROVED = true
