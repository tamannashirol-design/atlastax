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
// RULE: when the words change, bump CONSENT_VERSION (everyone is asked again)
// and update CONSENT_COPY_FINGERPRINT. `npm run check:consent` fails until you
// do both, so a changed notice can never go out under an old version.

export const CONSENT_VERSION = 'draft-1'

/** First 12 characters of the SHA-256 of JSON.stringify(CONSENT_COPY). `npm run check:consent` prints the new value. */
export const CONSENT_COPY_FINGERPRINT = 'a0fa8e834a8d'

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
