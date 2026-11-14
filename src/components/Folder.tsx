import { motion } from 'framer-motion'
import { useId } from 'react'
import { spring } from '../lib/motion'
import { squircle } from '../lib/squircle'

// Folder illustration for the upload moment (approved design). Original drawing
// in the general form of a desktop folder.
//
// Three layers, each its own <g> so they animate independently:
//   1. back   back panel + tab (sage gradient)
//   2. sheet  plain rounded document sheet with sage skeleton lines
//   3. front  front panel, 16pt shorter (light sage → primary-tint), 1px top highlight
// plus the success check, drawn on the front panel.
// No strokes on the folder: shape comes from fills only. Continuous (squircle)
// corners using the radius tokens. Soft shadow: big blur, 12% navy. All colors
// are CSS variables from index.css (no hex). Decorative: role="presentation".
//
// Motion (MOTION-upload.md), transform + opacity only:
//   sheetIn  sheet slides down behind the front panel (soft)
//   lifted   folder rises 4px; its shadow softens (soft)
//   check    check pops (pop) and draws in over 250ms (quick)
//   reduce   no movement: the sheet and check fade (150ms) instead
//
// Geometry on the 4pt grid: folder 128×96 inside a 160×128 box (room for the shadow).

const R_PANEL = 12 // --radius-sm
const R_SMALL = 8

type Props = {
  /** 1 = 160×128 */
  scale?: number
  sheetIn?: boolean
  lifted?: boolean
  check?: boolean
  reduce?: boolean
}

export function Folder({ scale = 1, sheetIn = false, lifted = false, check = false, reduce = false }: Props) {
  const id = useId().replace(/:/g, '')
  const back = `${id}-back`
  const front = `${id}-front`
  const blur = `${id}-blur`
  const hl = `${id}-hl`
  const inside = `${id}-inside`
  const tick = `${id}-tick`
  const frontPath = squircle(0, 28, 128, 68, R_PANEL)
  const move = reduce ? spring.fade : spring.soft

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
        {/* The sheet never shows below the folder's bottom edge as it slides in */}
        <clipPath id={inside}>
          <rect x={0} y={-24} width={128} height={120} />
        </clipPath>
        <clipPath id={tick}>
          {/* Check revealed left to right by scaling this rectangle (transform only) */}
          <motion.rect
            x={50}
            y={48}
            width={28}
            height={28}
            style={{ originX: 0 }}
            initial={false}
            animate={{ scaleX: check || reduce ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { ...spring.quick, delay: check ? 0.06 : 0 }}
          />
        </clipPath>
      </defs>

      <g transform="translate(16 8)">
        {/* Soft shadow stays on the ground; it fades a little when the folder lifts */}
        <motion.ellipse
          cx={64}
          cy={98}
          rx={52}
          ry={6}
          filter={`url(#${blur})`}
          style={{ fill: 'var(--folder-shadow)' }}
          initial={false}
          animate={{ opacity: lifted && !reduce ? 0.08 : 0.12 }}
          transition={move}
        />

        <motion.g data-folder-body initial={false} animate={{ y: lifted && !reduce ? -4 : 0 }} transition={{ ...move, delay: lifted || reduce ? 0 : 0.25 }}>
          {/* 1. Back panel with tab. The tab's sloped shoulder blends into the panel. */}
          <g data-layer="back" style={{ fill: `url(#${back})` }}>
            <path d={squircle(0, 0, 44, 24, [R_SMALL, 0, 0, 0])} />
            <path d="M44 0 C52 0 52 12 60 12 L44 12 Z" />
            <path d={squircle(0, 12, 128, 84, R_PANEL)} />
          </g>

          {/* 2. Document sheet: slides down behind the front panel */}
          <g clipPath={`url(#${inside})`}>
            <motion.g
              data-layer="sheet"
              initial={false}
              animate={reduce ? { y: 0, opacity: sheetIn ? 0 : 1 } : { y: sheetIn ? 24 : 0, opacity: 1 }}
              transition={move}
            >
              <path d={squircle(16, 8, 96, 72, R_SMALL)} style={{ fill: 'var(--color-surface)' }} />
              <rect x={28} y={16} width={40} height={4} rx={2} style={{ fill: 'var(--color-border-decorative)' }} />
              <rect x={28} y={24} width={24} height={4} rx={2} style={{ fill: 'var(--color-border-decorative)' }} />
            </motion.g>
          </g>

          {/* 3. Front panel (shorter, so the sheet sits inside) + 1px top highlight */}
          <g data-layer="front">
            <path d={frontPath} style={{ fill: `url(#${front})` }} />
            <path d={frontPath} clipPath={`url(#${hl})`} style={{ fill: 'var(--folder-highlight)', opacity: 0.9 }} />
          </g>

          {/* Success check on the front panel: thin outline circle + check, success token */}
          <motion.g
            data-check
            style={{ originX: 0.5, originY: 0.5 }}
            initial={false}
            animate={check ? { opacity: 1, scale: 1 } : { opacity: 0, scale: reduce ? 1 : 0 }}
            transition={reduce ? spring.fade : { scale: spring.pop, opacity: spring.fade }}
          >
            <circle cx={64} cy={62} r={15.25} fill="none" className="stroke-success" style={{ strokeWidth: 'var(--stroke-1-5)' }} />
            <path
              d="M57 62.5 L61.5 67 L71 57.5"
              fill="none"
              clipPath={`url(#${tick})`}
              className="stroke-success"
              style={{ strokeWidth: 'var(--stroke-1-5)' }}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.g>
        </motion.g>
      </g>
    </svg>
  )
}
