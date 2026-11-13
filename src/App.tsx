import FlowPage from './flow/FlowPage'
import { isFlowPath } from './flow/screens'
import { Link, usePath } from './lib/router'
import Styleguide from './styleguide/Styleguide'

// Picks a page from the address bar. Flow screens share one FlowPage so the
// shell and stepper stay mounted as you move between questions.
export default function App() {
  const path = usePath()
  if (path === '/styleguide') return <Styleguide />
  if (isFlowPath(path)) return <FlowPage path={path} />

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4">
      <p className="text-body">{path === '/' ? 'AtlasTax: Home is coming soon.' : 'This screen is coming soon.'}</p>
      <Link href="/visa" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
        Start the questions
      </Link>
      <Link href="/styleguide" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
        Style guide
      </Link>
    </main>
  )
}
