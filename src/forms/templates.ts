// The official blank forms the downloads are filled from, per tax year. Pure data (no Node imports),
// so the browser, the server and the checks read the same list. The files are in
// fixtures/synthetic/irs-blank-forms/ (see the README there for where each came from).
//
// The server checks each file's SHA-256 against this before using it, so a changed or swapped
// template is refused. Field names are the IRS's own; they are mapped in src/forms/map-*.ts.

export type FormId = 'form-8843' | 'form-1040nr'

export type Template = {
  /** Plain name shown on /result */
  label: string
  /** File in TEMPLATE_DIR */
  file: string
  /** SHA-256 of the official blank file */
  sha256: string
  /** The IRS revision, as printed on the form */
  revision: string
  catNo: string
  created: string
  /** Where it was fetched (Nov 16, 2026) */
  source: string
}

export const TEMPLATE_DIR = 'fixtures/synthetic/irs-blank-forms/'

export const TEMPLATES: Record<number, Record<FormId, Template>> = {
  2025: {
    'form-8843': {
      label: 'Form 8843',
      file: 'f8843--2025.pdf',
      sha256: 'b685fcb296ae6a86ee47d82ceaa5a7b64f0a04e1749420e89d6ddde5ab5a63c8',
      revision: 'Form 8843 (2025)',
      catNo: '17227H',
      created: '6/5/25',
      source: 'https://www.irs.gov/pub/irs-prior/f8843--2025.pdf',
    },
    'form-1040nr': {
      label: 'Form 1040-NR',
      file: 'f1040nr--2025.pdf',
      sha256: 'aa1c0523595ad630e097e41d42a35cbc7fa04685633a842d9ff4a7aa7b478c7a',
      revision: 'Form 1040-NR (2025)',
      catNo: '11364D',
      created: '9/8/25',
      source: 'https://www.irs.gov/pub/irs-prior/f1040nr--2025.pdf',
    },
  },
}

/** The templates for a tax year, or null when there are none (no download, a plain message). */
export const templatesFor = (year: number): Record<FormId, Template> | null => TEMPLATES[year] ?? null

/** The words stamped on every page of every download. */
export const PROTOTYPE_MARK = 'Prototype estimate, not for filing'
