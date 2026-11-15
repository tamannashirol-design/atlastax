import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/SecondaryButton'
import { UNSUPPORTED_MESSAGE } from '../residency.config'

// Outside the supported scope (students only, for now): a neutral message, no calculation, no advice.
export function UnsupportedSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet title={UNSUPPORTED_MESSAGE} onClose={onClose}>
      <p className="text-body text-text-muted">For now, AtlasTax works for students on an F-1 (including OPT and CPT), J-1 or M-1. If you’re here as a student, change your answer.</p>
      <div className="flex flex-col pt-8">
        <SecondaryButton onClick={onClose}>Change my answer</SecondaryButton>
      </div>
    </BottomSheet>
  )
}
