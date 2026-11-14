import DocumentsPage from './documents/DocumentsPage'
import FlowPage from './flow/FlowPage'
import { isFlowPath } from './flow/screens'
import HomePage from './home/HomePage'
import LandingPage from './landing/LandingPage'
import { useLoggedIn } from './lib/auth'
import PlaceholderPage from './pages/PlaceholderPage'
import { isPlaceholderPath } from './pages/placeholders'
import { Link, usePath } from './lib/router'
import MotionPage from './motion/MotionPage'
import Styleguide from './styleguide/Styleguide'

// Picks a page from the address bar. Flow screens share one FlowPage so the
// shell and stepper stay mounted as you move between questions.
export default function App() {
  const path = usePath()
  const loggedIn = useLoggedIn()
  if (path === '/styleguide') return <Styleguide />
  if (path === '/motion') return <MotionPage />
  if (isFlowPath(path)) return <FlowPage path={path} />
  // One Documents page for the tab and the flow (the flow opens it with { fromFlow: true })
  if (path === '/documents') return <DocumentsPage />
  // Logged out: the intro is the entry page. Logged in: Home (fake auth, see lib/auth)
  if (path === '/') return loggedIn ? <HomePage /> : <LandingPage />
  if (isPlaceholderPath(path)) return <PlaceholderPage path={path} />

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4">
      <p className="text-body">This screen is coming soon.</p>
      <Link href="/" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
        Go to Home
      </Link>
      <Link href="/styleguide" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
        Style guide
      </Link>
    </main>
  )
}
