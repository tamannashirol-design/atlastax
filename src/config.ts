// App-wide settings. Change values here only; never hard-code them in screens.

/**
 * The tax year being filed. Used by the stepper rail header, Home
 * ("File for 2025"), forms, deadlines, and anywhere else a year appears.
 * TODO(design): confirm 2025 or 2026.
 */
export const TAX_YEAR = 2025

/** Earlier years offered on Home under "File for previous years". */
export const PREVIOUS_TAX_YEARS = [TAX_YEAR - 1, TAX_YEAR - 2, TAX_YEAR - 3]
