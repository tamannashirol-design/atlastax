// Upload folder illustration (static; animation comes later).
// Inline SVG built only from design tokens. No hex values, no text inside the SVG.
//   body      primary-tint        outline  border-strong (2px stroke token)
//   file      surface             details  navy (text token)
//   progress  navy on a surface track
//   success   success token       error    error token
// Geometry sits on the 4pt grid: a 96×80 folder in a 104×88 box (4px inset so
// the 2px outlines aren't clipped). Panel and file corners use --radius-sm;
// bars use "full" (pill) ends.
// Decorative: the state is also given in real HTML text next to it.

export type UploadState = 'idle' | 'uploading' | 'success' | 'error'

type Props = { state: UploadState; /** 0–1, for "uploading" */ progress?: number }

// "Full" radius (pill ends) = half the bar's height. SVG clamps rx and ry
// separately, so a huge value would give pointed ellipse ends instead of pills.
const pill = (h: number) => ({ rx: h / 2, ry: h / 2 })

const outline = {
  className: 'fill-primary-tint stroke-border-strong',
  style: { strokeWidth: 'var(--stroke-2)', rx: 'var(--radius-sm)' },
  vectorEffect: 'non-scaling-stroke',
} as const

export function UploadFolder({ state, progress = 0 }: Props) {
  return (
    <svg width={104} height={88} viewBox="-4 -4 104 88" aria-hidden className="shrink-0">
      {/* Tab, then back panel (covers the tab's lower edge) */}
      <rect x={0} y={0} width={40} height={20} {...outline} />
      <rect x={0} y={8} width={96} height={72} {...outline} />

      {/* File peeking out of the folder, with navy detail lines */}
      <rect
        x={24}
        y={12}
        width={48}
        height={48}
        className="fill-surface stroke-border-strong"
        style={{ strokeWidth: 'var(--stroke-2)', rx: 'var(--radius-sm)' }}
        vectorEffect="non-scaling-stroke"
      />
      <rect x={36} y={24} width={24} height={4} className="fill-text" {...pill(4)} />
      <rect x={36} y={32} width={16} height={4} className="fill-text" {...pill(4)} />

      {/* Front panel (covers the bottom of the file) */}
      <rect x={0} y={40} width={96} height={40} {...outline} />

      {state === 'uploading' && (
        <>
          <rect x={16} y={60} width={64} height={4} className="fill-surface" {...pill(4)} />
          <rect x={16} y={60} width={Math.round(64 * Math.min(1, Math.max(0, progress)))} height={4} className="fill-text" {...pill(4)} />
        </>
      )}

      {state === 'success' && (
        <>
          <circle cx={80} cy={64} r={12} className="fill-success" />
          <path
            d="M74 64 L78 68 L86 60"
            fill="none"
            className="stroke-on-primary"
            style={{ strokeWidth: 'var(--stroke-2)' }}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {state === 'error' && (
        <>
          <circle cx={80} cy={64} r={12} className="fill-error" />
          <rect x={79} y={56} width={2} height={10} className="fill-on-primary" {...pill(2)} />
          <rect x={79} y={69} width={2} height={3} className="fill-on-primary" {...pill(2)} />
        </>
      )}
    </svg>
  )
}
