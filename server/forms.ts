// Turns a FormFill (src/forms) into a PDF: the official blank form, filled, with "Prototype estimate, not
// for filing" on every page and a last page listing what was left blank.
//
// Privacy, by construction (tested by `npm run check:forms`):
//   - the PDF exists only in memory: this file writes nothing to disk and logs nothing
//   - ID numbers arrive already masked (last 4 only): nothing here can show more
//   - the blank template is checked against its pinned fingerprint before use
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PDFDict, PDFDocument, PDFName, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { PROTOTYPE_MARK, TEMPLATE_DIR, templatesFor, type Template } from '../src/forms/templates.ts'
import type { FormFill } from '../src/forms/types.ts'

export class FormError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const RED = rgb(0.69, 0.14, 0.09)
const INK = rgb(0.05, 0.1, 0.17)
const MUTED = rgb(0.36, 0.42, 0.35)

/** WinAnsi is all the built-in PDF fonts can draw: keep the letters it has, turn the rest into plain ones. */
const winAnsi = (s: string) =>
  s
    .replace(/[⁠​]/g, '')
    .replace(/[‐‑−]/g, '-')
    .replace(/[^\x20-\x7e -ÿ‘’“”–—•…]/g, '?')

/** The filename offered for the download: it says prototype, the form and the year. */
export const downloadName = (fill: Pick<FormFill, 'id'>, year: number) => `AtlasTax-PROTOTYPE-${fill.id === 'form-8843' ? 'Form-8843' : 'Form-1040-NR'}-${year}.pdf`

async function template(tpl: Template): Promise<Uint8Array> {
  const bytes = await readFile(new URL(`../${TEMPLATE_DIR}${tpl.file}`, import.meta.url))
  if (createHash('sha256').update(bytes).digest('hex') !== tpl.sha256) throw new FormError('template-changed')
  return bytes
}

/** The mark on EVERY page: a line across the top and a faint diagonal across the middle. */
function mark(page: PDFPage, bold: PDFFont) {
  const { width, height } = page.getSize()
  const size = 10
  const w = bold.widthOfTextAtSize(PROTOTYPE_MARK, size)
  page.drawText(PROTOTYPE_MARK, { x: (width - w) / 2, y: height - 20, size, font: bold, color: RED })
  page.drawText(PROTOTYPE_MARK, { x: width * 0.1, y: height * 0.3, size: 38, font: bold, color: RED, opacity: 0.1, rotate: degrees(38) })
}

/** The last page(s): not part of the IRS form; says what was left blank, what to check, and what isn't included. */
function listPages(doc: PDFDocument, regular: PDFFont, bold: PDFFont, fill: FormFill, tpl: Template) {
  const lines: { text: string; font: PDFFont; size: number; gap: number; color?: ReturnType<typeof rgb> }[] = []
  const heading = (text: string) => lines.push({ text, font: bold, size: 12, gap: 14, color: INK })
  const item = (text: string) => lines.push({ text: `•  ${text}`, font: regular, size: 10, gap: 6, color: INK })
  lines.push({ text: `${tpl.revision}: what is left to do`, font: bold, size: 15, gap: 8, color: INK })
  lines.push({ text: 'This page is not part of the IRS form. This is a prototype estimate made from the details you confirmed. It is not for filing.', font: regular, size: 10, gap: 6, color: MUTED })
  heading('Left blank (fill in by hand if you ever file)')
  if (fill.blank.length) fill.blank.forEach(item)
  else item('Nothing.')
  if (fill.check.length) {
    heading('Please check')
    fill.check.forEach(item)
  }
  if (fill.notIncluded.length) {
    heading('Not included')
    fill.notIncluded.forEach(item)
  }
  heading('ID numbers')
  item('Only the last 4 digits of any ID number are shown on this form.')

  const margin = 54
  let page = doc.addPage([612, 792])
  mark(page, bold)
  let y = 792 - 64
  for (const l of lines) {
    const text = winAnsi(l.text)
    // rough wrap: how many lines this takes at the page width
    const width = 612 - margin * 2
    let rows = 1
    let cur = ''
    for (const word of text.split(' ')) {
      const next = cur ? `${cur} ${word}` : word
      if (l.font.widthOfTextAtSize(next, l.size) > width && cur) {
        rows++
        cur = word
      } else cur = next
    }
    const height = rows * (l.size + 3)
    if (y - height < 56) {
      page = doc.addPage([612, 792])
      mark(page, bold)
      y = 792 - 64
    }
    page.drawText(text, { x: margin, y: y - l.size, size: l.size, font: l.font, color: l.color ?? INK, maxWidth: width, lineHeight: l.size + 3 })
    y -= height + l.gap
  }
}

/** The PDF for a ready form. Throws FormError('not-ready') for one that isn't. */
export async function renderForm(fill: FormFill, year: number): Promise<Uint8Array> {
  const tpl = templatesFor(year)?.[fill.id]
  if (fill.status !== 'ready' || !tpl) throw new FormError('not-ready')

  const doc = await PDFDocument.load(await template(tpl), { ignoreEncryption: true, updateMetadata: false })
  // The IRS file carries an XFA copy of the form and a Reader-extensions signature. Both would show the
  // blank form (or a warning) in some viewers once the fields are filled, so they are dropped from OUR copy.
  doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict).delete(PDFName.of('XFA'))
  doc.catalog.delete(PDFName.of('Perms'))

  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const form = doc.getForm()
  for (const [name, value] of Object.entries(fill.values)) {
    if (value === true) form.getCheckBox(name).check()
    else form.getTextField(name).setText(winAnsi(value))
  }
  form.updateFieldAppearances(regular)

  const pages = doc.getPages()
  for (const o of fill.overlays) {
    const page = pages[o.page - 1]
    if (page) page.drawText(winAnsi(o.text), { x: o.x, y: o.y, size: o.size, font: regular, color: INK, maxWidth: o.maxWidth, lineHeight: o.size + 1 })
  }
  for (const page of pages) mark(page, bold)
  listPages(doc, regular, bold, fill, tpl)

  doc.setTitle(`${tpl.revision}: ${PROTOTYPE_MARK}`)
  doc.setSubject(PROTOTYPE_MARK)
  doc.setAuthor('')
  doc.setCreator('AtlasTax prototype')
  doc.setProducer('AtlasTax prototype')
  doc.setKeywords([])
  return doc.save()
}
