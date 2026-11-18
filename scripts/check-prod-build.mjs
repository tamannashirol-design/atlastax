// After `vite build`: the production bundle must NOT contain the development-only
// pages (/styleguide, /motion) or their test uploads. App.tsx loads them only when
// import.meta.env.DEV, which is false in a production build.
// Runs at the end of `npm run build`.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'dist', 'assets')
const js = readdirSync(dir).filter((f) => f.endsWith('.js'))
const text = js.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')

// Words that only exist on those pages
const devOnly = { 'Masked ID numbers': '/styleguide', 'Mock reader scenario': '/motion', 'Upload moment': '/motion', 'Scrub uploading': '/motion', 'AtlasTax design system': '/styleguide/overview' }
// And something that must be there, so a broken build can't pass by being empty
const mustHave = ['Add each document to continue.']

let failed = 0
for (const [words, page] of Object.entries(devOnly)) {
  const found = text.includes(words)
  console.log(`${found ? '✗' : '✓'} ${page} is not in the production build ("${words}")`)
  if (found) failed++
}
for (const words of mustHave) {
  const found = text.includes(words)
  console.log(`${found ? '✓' : '✗'} the app itself is there ("${words}")`)
  if (!found) failed++
}
console.log(failed ? `\n${failed} failed` : `\n✓ Production build checked (${js.length} script files).`)
process.exit(failed ? 1 : 0)
