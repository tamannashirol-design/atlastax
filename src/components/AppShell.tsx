import { CaretLeftIcon, FileTextIcon, HouseIcon, UserIcon, type Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link, navigate } from '../lib/router'
import { FakeAuthBadge } from './FakeAuthBadge'

// App shell: three rows filling the screen.
//   1. Top bar (every breakpoint): back, title.
//   2. Content: the only part that scrolls, so nothing ever sits under a bar.
//   3. Tab bar (phones only, below 768px).
// Heights come from layout tokens in index.css (--top-bar-h, --tab-bar-h,
// plus safe-area insets).

type Tab = 'home' | 'documents' | 'profile'

const tabs: { id: Tab; href: string; label: string; Icon: Icon }[] = [
  { id: 'home', href: '/', label: 'Home', Icon: HouseIcon },
  { id: 'documents', href: '/documents', label: 'Documents', Icon: FileTextIcon },
  { id: 'profile', href: '/profile', label: 'Profile', Icon: UserIcon },
]

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

/** action: the top bar's right side (e.g. "Save and exit"). Default: the fake sign-in badge (testing only). */
type Props = { title: ReactNode; backHref?: string; /** History state for the back arrow (e.g. { fromFlow: true }) */ backState?: Record<string, unknown>; activeTab: Tab; action?: ReactNode; children: ReactNode }

export function AppShell({ title, backHref, backState, activeTab, action, children }: Props) {
  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto]">
      {/* Hairline drawn as an inset shadow so the bar stays exactly --top-bar-h tall */}
      <header className="scroll-gutter bg-background shadow-[inset_0_-1px_0_var(--color-border-decorative)] pt-(--safe-top) page-x">
        {/* Equal side columns keep the title centred whatever sits on the right */}
        <div className="grid h-(--top-bar-h) page-content grid-cols-[minmax(2.75rem,1fr)_auto_minmax(2.75rem,1fr)] items-center gap-2">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Back"
              onClick={
                backState
                  ? (e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                      e.preventDefault()
                      navigate(backHref, backState)
                    }
                  : undefined
              }
              className={`flex size-11 items-center rounded-sm ${focusRing}`}
            >
              {/* viewBox cropped to the glyph so the arrow itself sits on the margin */}
              <CaretLeftIcon size={24} width={9} viewBox="72 0 96 256" weight="regular" aria-hidden />
            </Link>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex min-w-0 justify-center truncate text-center text-body font-semibold">{title}</div>
          <div className="flex min-w-0 justify-end">{action ?? <FakeAuthBadge />}</div>
        </div>
      </header>

      <main className="flex min-h-0 flex-col overflow-y-auto [scrollbar-gutter:stable]">{children}</main>

      <nav
        aria-label="Main"
        className="scroll-gutter bg-background pb-(--safe-bottom) shadow-[inset_0_1px_0_var(--color-border-decorative)] page-x tabbar-hidden:hidden"
      >
        <ul className="flex h-(--tab-bar-h) page-content">
          {tabs.map(({ id, href, label, Icon }) => {
            const active = id === activeTab
            return (
              <li key={id} className="flex flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-sm text-small ${
                    active ? 'font-semibold text-text' : 'text-text-muted'
                  } ${focusRing}`}
                >
                  <Icon size={24} weight="regular" aria-hidden />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
