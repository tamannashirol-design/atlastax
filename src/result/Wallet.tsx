import { motion } from 'framer-motion'
import { spring } from '../lib/motion'
import { squircle } from '../lib/squircle'

// Wallet illustration for the E-file concept screen. Original drawing: a wallet holding three generic cards
// (debit, credit, bank account), no brand names, logos or brand colors. Decorative (role="presentation"): the
// words are real HTML next to it, none inside the picture. Colors are CSS variables only (sage, a light cobalt
// wash, navy details); solid cobalt is the primary button's, so it isn't used here.
//
// The cards are straight (not tilted) and stacked in one column, each 16 lower than the one behind it, so the top
// edge of every card shows above the pocket (like a stack of cards in a wallet app).
// Motion, transform + opacity only: the cards drop into the wallet ONE AFTER THE OTHER (debit, credit, then bank
// account, 300ms apart), each with the soft spring (a slight settle); the pocket in front hides their lower parts.
// Reduced motion: no movement, the cards fade in together (150ms).
//
// Geometry on the 4pt grid: 240×176.
const R = 16 // --radius-md-ish
/** Time between one card and the next (s). The cards use the soft token (400ms), so this is what slows the whole picture down. */
export const CARD_GAP = 0.3
/** When the first card starts (s) */
export const CARD_START = 0.05
/** When the last card has landed (s): the amount counts up after this (the soft spring is 400ms) */
export const CARDS_DONE = CARD_START + CARD_GAP * 2 + 0.4

export function Wallet({ reduce = false, play = true }: { reduce?: boolean; /** false = show the finished picture without animating */ play?: boolean }) {
  return (
    <svg width={240} height={176} viewBox="0 0 240 176" role="presentation" aria-hidden className="max-w-full shrink-0 overflow-visible" data-wallet>
      {/* back of the wallet */}
      <path d={squircle(16, 48, 208, 108, R)} style={{ fill: 'var(--wallet-back)' }} />

      {/* The three cards: straight, one column, each 16 lower than the one behind it; they drop in one after the other */}
      {[0, 1, 2].map((i) => (
        <motion.g
          key={i}
          data-wallet-card={['debit', 'credit', 'bank'][i]}
          initial={play ? (reduce ? { opacity: 0 } : { y: -64, opacity: 0 }) : false}
          animate={{ y: 0, opacity: 1 }}
          transition={reduce ? spring.fade : { ...spring.soft, delay: CARD_START + i * CARD_GAP }}
        >
          <path d={squircle(56, 8 + i * 16, 128, 72, 8)} style={{ fill: ['var(--wallet-card-tint)', 'var(--color-surface)', 'var(--wallet-card-sage)'][i] }} />
          {i === 0 && <rect x={56} y={12} width={128} height={8} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />}
          {i === 1 && (
            <>
              <rect x={68} y={28} width={16} height={8} rx={2} style={{ fill: 'var(--wallet-card-sage)' }} />
              <rect x={92} y={30} width={40} height={4} rx={2} style={{ fill: 'var(--color-border-decorative)' }} />
            </>
          )}
          {i === 2 && (
            <>
              {/* a small building: roof, columns, base */}
              <path d="M104 58 L120 48 L136 58 Z" style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
              <rect x={107} y={60} width={5} height={14} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
              <rect x={117.5} y={60} width={5} height={14} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
              <rect x={128} y={60} width={5} height={14} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
              <rect x={102} y={76} width={36} height={4} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
            </>
          )}
        </motion.g>
      ))}

      {/* front pocket hides the lower part of every card */}
      <defs>
        <linearGradient id="wallet-front" gradientUnits="userSpaceOnUse" x1={0} y1={88} x2={0} y2={156}>
          <stop offset="0" style={{ stopColor: 'var(--wallet-front-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--wallet-front-bottom)' }} />
        </linearGradient>
      </defs>
      <path d={squircle(16, 88, 208, 68, R)} style={{ fill: 'url(#wallet-front)' }} />
      <rect x={16} y={88} width={208} height={1} style={{ fill: 'var(--color-surface)' }} />
      {/* clasp */}
      <path d={squircle(172, 108, 52, 28, 10)} style={{ fill: 'var(--color-text)', opacity: 0.85 }} />
      <circle cx={190} cy={122} r={4} style={{ fill: 'var(--color-surface)' }} />
    </svg>
  )
}
