// "Delete my documents": what each choice removes. Pure (no React, no network); the server and the browser both read it,
// so "tax forms" means the same thing in both places.
//
//   forms       the tax forms: every document in DOCUMENT_RULES (W-2, 1042-S, 1099 and the brokerage/investment forms),
//               and what we read from them. KEEPS passport, I-94, driver's license or state ID, the I-20 or DS-2019, the visa
//               answer and the previous return (the instructions name W-2, 1042-S and 1099 only; the previous return is
//               kept because it is not one of those: TODO confirm with CPA).
//   everything  every uploaded file, everything read from them, and every stored answer, for every tax year.
// Consent (the privacy agreement) is not a document and is kept.

export type DeleteScope = 'forms' | 'everything'
export const isDeleteScope = (v: unknown): v is DeleteScope => v === 'forms' || v === 'everything'

/** The Documents item ids that are tax forms */
// Typed out here (not read from documents.config.ts) because the server's build can't import that file; npm run check:delete
// proves this list equals DOCUMENT_RULES.
export const TAX_FORM_ITEM_IDS: readonly string[] = ['bank-interest', 'opt-cpt', 'on-campus-job', 'scholarship', 'freelance', 'investments', 'trading', 'contract-work']
export const isTaxFormItem = (itemId: string | undefined): boolean => !!itemId && TAX_FORM_ITEM_IDS.includes(itemId)

/** Does this scope remove files uploaded for this item (undefined: a file with no item)? */
export const scopeCovers = (scope: DeleteScope, itemId: string | undefined) => scope === 'everything' || isTaxFormItem(itemId)

/** The words on the confirmation sheet and the result. TODO confirm with legal. */
export const DELETE_COPY: Record<DeleteScope, { title: string; will: string[]; keeps: string | null; button: string; deleting: string; done: string; doneLine: string }> = {
  forms: {
    title: 'Delete tax forms only?',
    will: ['Your W-2, 1042-S and 1099 documents', 'The details we read from them'],
    keeps: 'We keep your passport, I-20 or DS-2019, visa, I-94 and ID.',
    button: 'Delete tax forms',
    deleting: 'Deleting your tax forms',
    done: 'Tax forms deleted',
    doneLine: 'Your passport, I-20 or DS-2019, visa, I-94 and ID are still here.',
  },
  everything: {
    title: 'Delete everything?',
    will: ['Every document you uploaded', 'The details we read from them', 'Your answers, for every tax year'],
    keeps: null,
    button: 'Delete everything',
    deleting: 'Deleting everything',
    done: 'Everything’s been deleted',
    doneLine: 'Nothing of yours is stored here now. You can start again any time.',
  },
}
