import { motion } from 'framer-motion'
import { spring } from '../lib/motion'
import { squircle } from '../lib/squircle'

// Wallet illustration for the E-file concept screen. Original drawing: a wallet holding three generic cards
// (debit, credit, bank account), no brand names, logos or brand colors. Decorative (role="presentation"): the
// words are real HTML next to it, none inside the picture. Colors are CSS variables only (sage, a light cobalt
// wash, navy details); solid cobalt is the primary button's, so it isn't used here.
//
// Cards, from the back: debit (navy stripe), credit (chip), bank account (a small building: columns and a roof).
// Motion, transform + opacity only: the bank-account card slides down into the wallet (soft), and the pocket in
// front of it hides its lower part. Reduced motion: no movement, the card fades in (150ms).
//
// Geometry on the 4pt grid: 240×176.
const R = 16 // --radius-md-ish

export function Wallet({ reduce = false, play = true }: { reduce?: boolean; /** false = show the finished picture without animating */ play?: boolean }) {
  return (
    <svg width={240} height={176} viewBox="0 0 240 176" role="presentation" aria-hidden className="max-w-full shrink-0 overflow-visible" data-wallet>
      {/* back of the wallet */}
      <path d={squircle(16, 48, 208, 108, R)} style={{ fill: 'var(--wallet-back)' }} />

      {/* debit card: a navy stripe */}
      <g transform="rotate(-8 84 60)">
        <path d={squircle(28, 16, 112, 72, 8)} style={{ fill: 'var(--wallet-card-tint)' }} />
        <rect x={28} y={32} width={112} height={12} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
        <rect x={40} y={64} width={32} height={4} rx={2} style={{ fill: 'var(--color-surface)' }} />
      </g>

      {/* credit card: a chip and two lines */}
      <g transform="rotate(2 120 52)">
        <path d={squircle(64, 8, 112, 72, 8)} style={{ fill: 'var(--color-surface)' }} />
        <rect x={76} y={24} width={24} height={16} rx={4} style={{ fill: 'var(--wallet-card-sage)' }} />
        <rect x={76} y={52} width={56} height={4} rx={2} style={{ fill: 'var(--color-border-decorative)' }} />
        <rect x={76} y={60} width={32} height={4} rx={2} style={{ fill: 'var(--color-border-decorative)' }} />
      </g>

      {/* bank account card: slides down into the wallet */}
      <motion.g
        data-wallet-card
        initial={play ? (reduce ? { opacity: 0 } : { y: -56, opacity: 0 }) : false}
        animate={{ y: 0, opacity: 1 }}
        transition={reduce ? spring.fade : { ...spring.soft, delay: 0.05 }}
      >
        <g transform="rotate(8 156 56)">
          <path d={squircle(100, 20, 112, 72, 8)} style={{ fill: 'var(--wallet-card-sage)' }} />
          {/* a small building: roof, columns, base */}
          <path d="M132 40 L156 28 L180 40 Z" style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
          <rect x={136} y={44} width={6} height={20} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
          <rect x={153} y={44} width={6} height={20} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
          <rect x={170} y={44} width={6} height={20} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
          <rect x={130} y={68} width={52} height={5} rx={1} style={{ fill: 'var(--color-text)', opacity: 0.8 }} />
        </g>
      </motion.g>

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
