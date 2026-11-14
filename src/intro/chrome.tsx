import { Link } from '../lib/router'

// Pieces of the logged-out intro page shared by both compositions.

export type IntroMode = 'page' | 'replay'

// TODO confirm: who the app is for. Describes the audience only; no outcome promises.
export const WHO_FOR = 'For students on F‑1, J‑1 and M‑1 visas filing U.S. taxes.'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

/** Quiet "Log in" link (no accounts yet: goes to a placeholder page). */
export function LoginLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-12 items-center justify-center rounded-sm text-body font-semibold underline underline-offset-4 ${focusRing}`}>
      Log in
    </button>
  )
}

/** Footer: Privacy, Terms, Contact (placeholder pages for now). */
export function PageFooter({ center = false }: { center?: boolean }) {
  const links = [
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
    { href: '/contact', label: 'Contact' },
  ]
  return (
    <footer>
      <ul className={`flex flex-wrap gap-x-4 ${center ? 'justify-center' : ''}`}>
        {links.map((l) => (
          <li key={l.href} className="flex">
            <Link href={l.href} className={`flex min-h-11 min-w-11 items-center justify-center rounded-sm px-1 text-small text-text-muted underline underline-offset-4 ${focusRing}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  )
}
