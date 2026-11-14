import { UploadSimpleIcon } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useId, useRef } from 'react'
import { pressScale, spring } from '../lib/motion'

// Upload control for document questions. Fits the 88pt answer area:
//   button 56 · gap 8 · status line 20
// Secondary style (never blue): Continue stays the screen's one primary.
// Placeholder: only file names are remembered for now.

type Props = { files: string[]; onChange: (files: string[]) => void }

export function UploadField({ files, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const statusId = useId()
  return (
    <div className="flex flex-col gap-2">
      <motion.button
        type="button"
        aria-describedby={statusId}
        onClick={() => input.current?.click()}
        whileTap={{ scale: pressScale.button }}
        transition={spring.quick}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-sm border border-border-strong bg-surface px-6 text-body font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text active:bg-sage-100"
      >
        <UploadSimpleIcon size={24} weight="regular" aria-hidden />
        {files.length ? 'Add another file' : 'Upload file'}
      </motion.button>
      <p id={statusId} aria-live="polite" className="truncate text-small text-text-muted">
        {files.length ? `${files.length} added: ${files.join(', ')}` : 'No file added yet'}
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const names = [...(e.target.files ?? [])].map((f) => f.name)
          if (names.length) onChange([...files, ...names])
          e.target.value = ''
        }}
      />
    </div>
  )
}
