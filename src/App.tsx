import FlowPage from './flow/FlowPage'
import { isFlowPath } from './flow/screens'
import HomePage from './home/HomePage'
import { Link, usePath } from './lib/router'
import MotionPage from './motion/MotionPage'
import Styleguide from './styleguide/Styleguide'

// Picks a page from the address bar. Flow screens share one FlowPage so the
// shell and stepper stay mounted as you move between questions.
export default function App() {
  const path = usePath()
  if (path === '/styleguide') return <Styleguide />
  if (path === '/motion') return <MotionPage />
  if (isFlowPath(path)) return <FlowPage path={path} />
  if (path === '/') return <HomePage />

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
