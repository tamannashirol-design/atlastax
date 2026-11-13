// npm run contrast
// Tests every color pair in src/tokens/pairs.ts against the colors in src/index.css.
// Prints each ratio and exits with an error (failing the build) if any pair is too low.
import { readFileSync } from 'node:fs'
import { contrastRatio } from '../src/lib/contrast.ts'
import { parseColors } from '../src/tokens/colors.ts'
import { pairs, thresholds } from '../src/tokens/pairs.ts'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const colors = parseColors(css)

let failures = 0
console.log('\nContrast check (WCAG 2.x)\n')
console.log('  result  ratio   need  kind      foreground → background         used for')
console.log('  ' + '-'.repeat(100))

for (const p of pairs) {
  const fg = colors[p.fg]
  const bg = colors[p.bg]
  if (!fg || !bg) {
    console.log(`  MISSING token: ${!fg ? p.fg : p.bg}`)
    failures++
    continue
  }
  const ratio = contrastRatio(fg, bg)
  const need = thresholds[p.kind]
  const ok = ratio >= need
  if (!ok) failures++
  const pairName = `${p.fg} → ${p.bg}`.padEnd(32)
  console.log(
    `  ${ok ? 'PASS  ' : 'FAIL ✗'}  ${ratio.toFixed(2).padStart(5)}  ${need.toFixed(1).padStart(4)}  ${p.kind.padEnd(8)}  ${pairName}${p.use}`,
  )
}

console.log()
if (failures) {
  console.log(`✗ ${failures} pair(s) below the required contrast. Fix the tokens in src/index.css.\n`)
  process.exit(1)
}
console.log(`✓ All ${pairs.length} pairs pass.\n`)
