// Keeps real documents and real ID numbers out of the project.
// Run: npm run check:files (also runs before every build).
//
// 1. Documents and images: a PDF may only live in fixtures/synthetic/ (fake
//    test documents). Images may live there too, plus the design folders
//    listed in IMAGE_FOLDERS (illustrations, icons, old reference screens).
//    Files are recognised by their first bytes, not only their name, so a PDF
//    renamed to .txt is still caught.
// 2. SSN-like numbers: every text file is scanned for 123-45-6789 shaped
//    numbers (dashes or spaces). Only the obviously fake values in
//    FAKE_NUMBERS are allowed. Matches are reported by file and line, with
//    the number masked, never printed in full.
//
// Scans every file git tracks plus new files not ignored by .gitignore.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SYNTHETIC = 'fixtures/synthetic/'
/** Design images only (never PDFs). Add a folder here only for design artwork. */
const IMAGE_FOLDERS = ['src/assets/illustrations/', 'public/', 'references/']
const FAKE_NUMBERS = new Set(['123-45-6789', '000-00-0000', '111-11-1111', '555-55-5555'])

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const PDF_EXT = /\.pdf$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic|heif|tiff?|bmp|ico|svg)$/i
const BINARY_EXT = /\.(mov|mp4|webm|woff2?|ttf|otf|zip|gz)$/i

function kind(head: Buffer): 'pdf' | 'image' | null {
  const hex = head.subarray(0, 12).toString('hex')
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  if (hex.startsWith('89504e47') || hex.startsWith('ffd8ff') || hex.startsWith('47494638') || hex.startsWith('424d')) return 'image'
  if (hex.startsWith('52494646') && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image'
  if (hex.startsWith('49492a00') || hex.startsWith('4d4d002a')) return 'image' // TIFF
  if (head.subarray(4, 12).toString('latin1').match(/^ftyp(heic|heix|avif|mif1)/)) return 'image'
  return null
}

const mask = (n: string) => n.replace(/\d(?=[\d -]{4})/g, '•')
const SSN_LIKE = /(?<![\d-])\d{3}[- ]\d{2}[- ]\d{4}(?![\d-])/g

const problems: string[] = []
let scanned = 0

for (const path of files) {
  let data: Buffer
  try {
    data = readFileSync(path)
  } catch {
    continue // deleted but not yet committed
  }
  const k = PDF_EXT.test(path) ? 'pdf' : IMAGE_EXT.test(path) ? 'image' : kind(data)
  const inSynthetic = path.startsWith(SYNTHETIC)

  if (k === 'pdf' && !inSynthetic) problems.push(`${path}: PDFs are only allowed in ${SYNTHETIC}`)
  if (k === 'image' && !inSynthetic && !IMAGE_FOLDERS.some((f) => path.startsWith(f)))
    problems.push(`${path}: images are only allowed in ${SYNTHETIC} or the design folders (${IMAGE_FOLDERS.join(', ')})`)

  // Text scan: skip binary files (known binary types, or containing a zero byte)
  if (k === 'pdf' || (k === 'image' && !/\.svg$/i.test(path)) || BINARY_EXT.test(path) || data.includes(0)) continue
  scanned++
  data
    .toString('utf8')
    .split('\n')
    .forEach((text, i) => {
      for (const [m] of text.matchAll(SSN_LIKE)) {
        if (!FAKE_NUMBERS.has(m.replace(/ /g, '-'))) problems.push(`${path}:${i + 1}: SSN-like number ${mask(m)} (only ${[...FAKE_NUMBERS].join(', ')} are allowed)`)
      }
    })
}

console.log(`Checked ${files.length} files (${scanned} text files scanned for SSN-like numbers).`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + problems.map((p) => '  ✗ ' + p).join('\n'))
  process.exit(1)
}
console.log('✓ No PDFs or images outside the allowed folders, no SSN-like numbers except the allowed fake ones.')
