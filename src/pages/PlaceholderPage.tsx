import { useEffect } from 'react'
import { Logo } from '../components/Logo'
import { Link } from '../lib/router'
import { PLACEHOLDER_PAGES as PAGES } from './placeholders'

// Placeholder pages linked from the logged-out page: Privacy, Terms, Contact,
// and Log in. TODO confirm: real content (and real sign-in) to come.

export default function PlaceholderPage({ path }: { path: string }) {
  const page = PAGES[path]
  useEffect(() => {
    document.title = `${page.title} · AtlasTax`
  }, [page.title])
  return (
    <div className="flex min-h-dvh flex-col pt-(--safe-top) pb-(--safe-bottom) page-x">
      <header className="page-content flex h-(--top-bar-h) items-center">
        <Link href="/" aria-label="AtlasTax home" className="flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
          <Logo />
        </Link>
      </header>
      <main className="page-content page-grid flex-1 content-start pt-8">
        <div className="col-span-full flex flex-col gap-2 tablet:col-span-6 tablet:col-start-2 desktop:col-start-4">
          <h1 className="font-display text-display">{page.title}</h1>
          {/* TODO confirm: placeholder copy */}
          <p className="text-body text-text-muted">{page.body} This is a placeholder page.</p>
          <Link href="/" className="mt-6 flex min-h-11 items-center self-start rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
            Back to AtlasTax
          </Link>
        </div>
      </main>
    </div>
  )
}
