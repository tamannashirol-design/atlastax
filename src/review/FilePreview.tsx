// The document preview: a PLACEHOLDER card per file ("Passport, file 1") with quiet
// sage page lines. It never shows the real file or any value (showing the person's
// own file back is an open question for legal: EXTRACTION-PLAN.md Q-B).
// Decorative lines are aria-hidden; the label is real text.

const LINES = [88, 72, 80, 56, 64, 40]

export function FilePreview({ name, files }: { name: string; files: number }) {
  const count = Math.max(1, files)
  return (
    <ul aria-label={`${name}: ${count} ${count === 1 ? 'file' : 'files'}`} className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex aspect-[3/4] max-h-112 w-full flex-col gap-6 rounded-lg border border-border-decorative bg-surface p-6 shadow-1">
          <p className="text-small font-semibold">
            {name}, file {i + 1}
          </p>
          <div aria-hidden className="flex flex-1 flex-col gap-3">
            {LINES.map((w) => (
              <div key={w} className="h-2 rounded-full bg-sage-100" style={{ width: `${w}%` }} />
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
