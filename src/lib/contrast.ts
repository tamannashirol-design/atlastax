// WCAG 2.x contrast ratio between two hex colors.
// AA needs 4.5:1 for normal text, 3:1 for large text (≥24px, or ≥19px bold) and UI parts.

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export type AaLevel = 'text' | 'large' | 'fail'

export function aaLevel(ratio: number): AaLevel {
  if (ratio >= 4.5) return 'text'
  if (ratio >= 3) return 'large'
  return 'fail'
}
