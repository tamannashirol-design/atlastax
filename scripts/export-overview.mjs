// Saves the design system overview as a crisp 2x PNG (3840x2160): exports/design-system-overview@2x.png
//   npm run dev                      (one terminal)
//   npm run export:overview          (another)         add  -- --transparent  for a PNG with no background
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const transparent = process.argv.includes('--transparent')
try {
  await fetch(BASE)
} catch {
  console.error(`Can't reach ${BASE}. Start the app with "npm run dev" first.`)
  process.exit(1)
}
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })
await page.goto(`${BASE}/styleguide/overview${transparent ? '?bg=transparent' : ''}`, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(400)
mkdirSync('exports', { recursive: true })
const file = `exports/design-system-overview${transparent ? '-transparent' : ''}@2x.png`
await page.screenshot({ path: file, omitBackground: transparent })
await browser.close()
console.log(`Saved ${file} (3840x2160)`)
