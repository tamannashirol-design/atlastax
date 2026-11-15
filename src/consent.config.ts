// CONSENT NOTICE: what people agree to before the first document is uploaded
// (EXTRACTION-PLAN.md §4). The ONE place its words and its version live; the
// browser and the server both read it.
//
// TODO confirm with legal: ALL of this wording is a PLACEHOLDER. It says only
// what the prototype really does today, makes no promises, and leaves the
// provider's name and the retention period to be filled in. Open legal items:
//   - who the provider is, and what its data agreement says
//   - how long documents and extracted values are kept
//   - whether this is enough as consent, and how to word withdrawal
//
// The SERVER sends these words to the browser (GET /api/consent), and the sheet
// shows exactly what it received, with its version and fingerprint (a short hash
// of the words). Agreeing sends that version and fingerprint back; the server
// records them only if they are the current notice. So nobody can be recorded as
// agreeing to words they weren't shown.
//
// RULE: when the words change, bump CONSENT_VERSION (everyone is asked again)
// and ADD a new line to CONSENT_NOTICES (keep the old lines: the server uses them
// to tell "you saw an older notice" from "unknown"). `npm run check:consent`
// fails until you do both, and prints the new fingerprint.

export const CONSENT_VERSION = 'draft-1'

/** Every notice ever published, oldest first; the last one is the current one. fingerprint = first 12 characters of the SHA-256 of JSON.stringify(CONSENT_COPY). */
export const CONSENT_NOTICES: { version: string; fingerprint: string }[] = [{ version: 'draft-1', fingerprint: 'a0fa8e834a8d' }]

export const CONSENT_COPY = {
  title: 'Before you add a document',
  lead: 'To fill in details for you, AtlasTax reads the documents you add.',
  rows: [
    { label: 'What we do', text: 'We read your documents to suggest the details on them, like amounts and dates. You check every detail before it’s used.' },
    { label: 'Who reads them', text: 'A document-reading service chosen by AtlasTax. Its name will be shown here.' },
    { label: 'How long we keep them', text: 'The time we keep documents will be shown here.' },
    { label: 'Deleting them', text: 'You can remove any document at any time. Removing it deletes it from AtlasTax.' },
  ],
  link: 'Read the full privacy notice',
  linkHref: '/privacy',
  accept: 'Continue to upload',
  decline: 'Not now',
  close: 'Close',
} as const
