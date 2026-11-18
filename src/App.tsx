import DocumentsPage from './documents/DocumentsPage'
import FlowPage from './flow/FlowPage'
import { EFILE_DONE_PATH, EFILE_PATH, READING_PATH, RESULT_PATH, REVIEW_PATH, STOP_PATH, isFlowPath, isGatedPath } from './flow/screens'
import ReadingPage from './reading/ReadingPage'
import ReviewPage from './review/ReviewPage'
import ResultPage from './result/ResultPage'
import EfilePage from './result/EfilePage'
import EfileDonePage from './result/EfileDonePage'
import { useAnswers, useFilingYear } from './flow/answers'
import { lazy, Suspense, useEffect } from 'react'
import HomePage from './home/HomePage'
import ProfilePage from './profile/ProfilePage'
import LandingPage from './landing/LandingPage'
import { useLoggedIn } from './lib/auth'
import PlaceholderPage from './pages/PlaceholderPage'
import { isPlaceholderPath } from './pages/placeholders'
import { Link, navigate, usePath } from './lib/router'

// Design and testing tools (/styleguide, /motion): DEVELOPMENT ONLY. In a production
// build import.meta.env.DEV is false, so these pages (and their test uploads) aren't
// even included; the addresses show "This screen is coming soon."
const Styleguide = import.meta.env.DEV ? lazy(() => import('./styleguide/Styleguide')) : null
const MotionPage = import.meta.env.DEV ? lazy(() => import('./motion/MotionPage')) : null

// Picks a page from the address bar. Flow screens share one FlowPage so the
// shell and stepper stay mounted as you move between questions.
export default function App() {
  const path = usePath()
  const loggedIn = useLoggedIn()
  const answers = useAnswers()
  const year = useFilingYear()
  // Outside the v1 scope, later questions, Documents and Review can't be reached, even by typing the address
  const gated = isGatedPath(path, answers, year)
  useEffect(() => {
    if (gated) navigate(STOP_PATH, null, { replace: true })
  }, [gated])
  if (gated) return null
  if (Styleguide && path === '/styleguide')
    return (
      <Suspense fallback={null}>
        <Styleguide />
      </Suspense>
    )
  if (MotionPage && path === '/motion')
    return (
      <Suspense fallback={null}>
        <MotionPage />
      </Suspense>
    )
  if (isFlowPath(path)) return <FlowPage path={path} />
  // One Documents page for the tab and the flow (the flow opens it with { fromFlow: true })
  if (path === '/documents') return <DocumentsPage />
  // After Documents → Continue (always shows; then Review)
  if (path === READING_PATH) return <ReadingPage />
  // Check your details (after the Reading page)
  if (path === REVIEW_PATH) return <ReviewPage />
  // Your estimate and downloads (after Review's "Looks good"); the flow ends here
  if (path === RESULT_PATH) return <ResultPage />
  // The E-file concept screen (from "Want to e-file instead?"); not connected to the IRS
  if (path === EFILE_PATH) return <EfilePage />
  // The celebration after a card, bank or direct deposit choice (concept)
  if (path === EFILE_DONE_PATH) return <EfileDonePage />
  // Logged out: the intro is the entry page. Logged in: Home (fake auth, see lib/auth)
  if (path === '/') return loggedIn ? <HomePage /> : <LandingPage />
  // The intro, always (logged in or not)
  if (path === '/welcome') return <LandingPage />
  if (path === '/profile') return <ProfilePage />
  if (isPlaceholderPath(path)) return <PlaceholderPage path={path} />

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4">
      <p className="text-body">This screen is coming soon.</p>
      <Link href="/" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
        Go to Home
      </Link>
      {import.meta.env.DEV && (
        <Link href="/styleguide" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
          Style guide
        </Link>
      )}
    </main>
  )
}
