import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/SecondaryButton'
import { useAnswers } from '../flow/answers'
import { DELETE_COPY, scopeCovers, type DeleteScope } from '../flow/deletion'
import { requiredItems } from '../flow/requiredDocuments'
import { navigate } from '../lib/router'

export const DELETED_PATH = '/deleted'

// The confirmation sheet for "Delete tax forms only" and "Delete everything" (same sheet as the others: title, X, buttons).
// Lists what goes, says "This can't be undone", a red confirm button and a plain Cancel (not cobalt: the screen's cobalt
// stays for its one primary action). The red button does NOT delete here: it opens the shredding stage (/deleted), which
// sends the request while the cards go into the shredder, and owns the error and Try again (MOTION-delete.md).
// The stage gets the cards (names and ids only, from the documents the person added): the ones this choice deletes, and
// the ones that stay. Render inside <AnimatePresence>.
export function DeleteSheet({ scope, onClose }: { scope: DeleteScope; onClose: () => void }) {
  const copy = DELETE_COPY[scope]
  const answers = useAnswers()
  const confirm = () => {
    const added = requiredItems(answers).filter((i) => i.kind === 'document' && i.status === 'added')
    const card = (i: (typeof added)[number]) => ({ id: i.id, name: i.form })
    navigate(DELETED_PATH, { deleted: scope, cards: added.filter((i) => scopeCovers(scope, i.id)).map(card), kept: added.filter((i) => !scopeCovers(scope, i.id)).map(card) })
  }

  return (
    <BottomSheet title={copy.title} onClose={onClose}>
      <p className="text-body text-text-muted">This will delete:</p>
      <ul className="flex list-disc flex-col gap-1 pt-2 pl-6 text-body">
        {copy.will.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {copy.keeps && <p className="pt-4 text-body text-text-muted">{copy.keeps}</p>}
      <p className="pt-4 text-body font-semibold">This can’t be undone.</p>

      <div className="flex flex-col gap-2 pt-8">
        <SecondaryButton tone="destructive" onClick={confirm}>
          {copy.button}
        </SecondaryButton>
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
      </div>
    </BottomSheet>
  )
}
