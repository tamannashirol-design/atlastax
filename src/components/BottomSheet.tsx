import { XIcon } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { spring } from '../lib/motion'

// Bottom sheet. Render it inside <AnimatePresence> so it can animate out.
// Built on the browser's modal <dialog>: traps focus, Escape closes, the page
// behind is inert, and it floats above the page without absolute positioning.
// Content sits on the same 6-column question grid as the screens.
// Motion: slides up with the soft spring; Reduce motion → fade only.
// Tall content: the sheet stops 24pt below the top (or the safe area) and
// scrolls inside. Closing puts focus back where it was (e.g. Continue).

type Props = { title: string; onClose: () => void; children: ReactNode }

export function BottomSheet({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const reduce = useReducedMotion()
  const titleId = useId()
  // Whatever had focus before the sheet opened (read once, on the first render)
  const opener = useRef(typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null))

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    // The dialog is removed rather than closed, so the browser can't restore focus itself
    const back = opener.current
    return () => {
      if (back?.isConnected) back.focus({ preventScroll: true })
    }
  }, [])

  return (
    <motion.dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault() // let the exit animation run first
        onClose()
      }}
      className="m-0 size-full max-h-none max-w-none bg-transparent p-0 text-text backdrop:bg-transparent"
    >
      {/* Scrim: tap outside the sheet to close */}
      <motion.div
        className="flex size-full flex-col justify-end bg-text/40 pt-[max(1.5rem,var(--safe-top))]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={spring.soft}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="min-h-0 overflow-y-auto overscroll-contain rounded-t-lg bg-surface pb-[max(1.5rem,env(safe-area-inset-bottom))] page-x shadow-3"
          initial={reduce ? { opacity: 0 } : { y: '100%' }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: '100%' }}
          transition={spring.soft}
        >
          <div className="page-content page-grid">
            <div className="col-span-full flex flex-col tablet:col-span-6 tablet:col-start-2 desktop:col-start-4">
              <div className="flex min-h-14 items-center justify-between gap-4 pt-2 pb-2">
                <h2 id={titleId} className="font-display text-title text-balance">
                  {title}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="flex size-11 shrink-0 items-center justify-end rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                >
                  <XIcon size={24} weight="regular" aria-hidden />
                </button>
              </div>
              {children}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.dialog>
  )
}
