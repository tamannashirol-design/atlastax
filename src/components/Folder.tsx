import { useId } from 'react'
import { squircle } from '../lib/squircle'

// Folder illustration for the upload moment. Original drawing in the general
// form of a desktop folder. Static for now (awaiting approval before animation).
//
// Three layers, each its own <g> so they can animate independently later:
//   1. back   back panel + tab (sage gradient)
//   2. sheet  plain rounded document sheet with sage skeleton lines
//   3. front  front panel, 16pt shorter (light sage → primary-tint), 1px top highlight
// No strokes: shape comes from fills only. Continuous (squircle) corners using
// the radius tokens (12 for panels, 8 for the tab and sheet). Soft shadow: big
// blur, 12% navy. All colors are CSS variables from index.css (no hex).
// Decorative: role="presentation", hidden from screen readers.
//
// Geometry on the 4pt grid: folder 128×96 inside a 160×128 box (room for the shadow).

const R_PANEL = 12 // --radius-sm
const R_SMALL = 8

type Props = { /** 1 = 160×128 */ scale?: number }

export function Folder({ scale = 1 }: Props) {
  const id = useId().replace(/:/g, '')
  const back = `${id}-back`
  const front = `${id}-front`
  const blur = `${id}-blur`
  const hl = `${id}-hl`
  const frontPath = squircle(0, 28, 128, 68, R_PANEL)

  return (
    <svg width={160 * scale} height={128 * scale} viewBox="0 0 160 128" role="presentation" aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={back} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={96}>
          <stop offset="0" style={{ stopColor: 'var(--folder-back-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--folder-back-bottom)' }} />
        </linearGradient>
        <linearGradient id={front} gradientUnits="userSpaceOnUse" x1={0} y1={28} x2={0} y2={96}>
          <stop offset="0" style={{ stopColor: 'var(--folder-front-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--folder-front-bottom)' }} />
        </linearGradient>
        <filter id={blur} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation={8} />
        </filter>
        <clipPath id={hl}>
          <rect x={0} y={28} width={128} height={1} />
        </clipPath>
      </defs>

      <g transform="translate(16 8)">
        {/* Soft shadow under the folder: large blur, 12% navy, no hard edges */}
        <ellipse cx={64} cy={98} rx={52} ry={6} filter={`url(#${blur})`} style={{ fill: 'var(--folder-shadow)', opacity: 0.12 }} />

        {/* 1. Back panel with tab. The tab's sloped shoulder blends into the panel. */}
        <g data-layer="back" style={{ fill: `url(#${back})` }}>
          <path d={squircle(0, 0, 44, 24, [R_SMALL, 0, 0, 0])} />
          <path d="M44 0 C52 0 52 12 60 12 L44 12 Z" />
          <path d={squircle(0, 12, 128, 84, R_PANEL)} />
        </g>

        {/* 2. Document sheet */}
        <g data-layer="sheet">
          <path d={squircle(16, 8, 96, 72, R_SMALL)} style={{ fill: 'var(--color-surface)' }} />
          <rect x={28} y={16} width={40} height={4} rx={2} style={{ fill: 'var(--color-border-decorative)' }} />
          <rect x={28} y={24} width={24} height={4} rx={2} style={{ fill: 'var(--color-border-decorative)' }} />
        </g>

        {/* 3. Front panel (shorter, so the sheet sits inside) + 1px top highlight */}
        <g data-layer="front">
          <path d={frontPath} style={{ fill: `url(#${front})` }} />
          <path d={frontPath} clipPath={`url(#${hl})`} style={{ fill: 'var(--folder-highlight)', opacity: 0.9 }} />
        </g>
      </g>
    </svg>
  )
}
