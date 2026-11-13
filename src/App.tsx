import VisaQuestion from './screens/VisaQuestion'
import Styleguide from './styleguide/Styleguide'

// Tiny router: pick a screen from the address bar path.
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/styleguide') return <Styleguide />
  if (path === '/visa') return <VisaQuestion />

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4">
      <p className="text-body">AtlasTax: screens coming soon.</p>
      <a href="/visa" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
        Visa question
      </a>
      <a href="/styleguide" className="flex min-h-11 items-center text-body font-semibold underline underline-offset-4">
        Style guide
      </a>
    </main>
  )
}
