import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/SecondaryButton'
import { UploadAnswer } from '../components/UploadAnswer'
import { setDetail, useAnswers } from '../flow/answers'
import type { DocumentItem } from '../flow/requiredDocuments'
import { UploadHostContext } from '../lib/uploadHost'

// The upload sheet for one document: "Add: W-2", where it comes from, the real
// upload (saved to the same answer the flow's upload question uses), and Done.
// Shared by the Documents page (Add / Replace / a file dropped on a card) and the
// Reading page ("Choose another file"). Render it inside <AnimatePresence>.
export function DocumentUploadSheet({ item, initialFile, onClose }: { item: DocumentItem; initialFile?: File; onClose: () => void }) {
  return (
    <BottomSheet title={`Add: ${item.form}`} onClose={onClose}>
      <p className="text-body text-text-muted">{item.source}</p>
      {/* "Not now" on the consent sheet closes this sheet too */}
      <UploadHostContext.Provider value={{ close: onClose }}>
        <div className="pt-6">
          <SheetUpload item={item} initialFile={initialFile} />
        </div>
      </UploadHostContext.Provider>
      <div className="flex flex-col pt-8">
        <SecondaryButton onClick={onClose}>Done</SecondaryButton>
      </div>
    </BottomSheet>
  )
}

/** The real upload, saving to the same answer the flow's upload question uses. */
function SheetUpload({ item, initialFile }: { item: DocumentItem; initialFile?: File }) {
  const answers = useAnswers()
  const v = answers.details?.[item.uploadScreen]
  const files = Array.isArray(v) ? v : []
  return (
    <UploadAnswer
      docLabel={item.form}
      uploaded={files}
      allowAnother
      initialFile={initialFile}
      upload={{ key: item.uploadScreen, itemId: item.id }}
      onUploaded={(name) => setDetail(item.uploadScreen, [...files, name])}
      onRemove={(i) =>
        setDetail(
          item.uploadScreen,
          files.filter((_, j) => j !== i),
        )
      }
    />
  )
}
