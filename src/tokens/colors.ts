// Reads color tokens (--color-name: #hex) out of the CSS text of src/index.css,
// so index.css stays the single source of truth for color values.
export function parseColors(css: string): Record<string, string> {
  const colors: Record<string, string> = {}
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)) {
    colors[m[1]] = m[2].toLowerCase()
  }
  return colors
}
