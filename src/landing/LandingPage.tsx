import { useEffect } from 'react'
import { TAX_YEAR } from '../config'
import { setFilingYear } from '../flow/answers'
import { IntroContent } from '../intro/IntroContent'
import { navigate } from '../lib/router'

// The logged-out entry page ("/" while logged out): the intro itself, as a
// page. Logged-in people land on Home instead (see App).
// Get started: starts the current year's return. TODO confirm: account
// creation will come first once accounts exist.
// Log in: a placeholder page (no real authentication yet).
export default function LandingPage() {
  useEffect(() => {
    document.title = 'AtlasTax'
  }, [])
  return (
    <div className="h-dvh">
      <IntroContent
        mode="page"
        onClose={(how) => {
          if (how === 'login') navigate('/login')
          else {
            setFilingYear(TAX_YEAR)
            navigate('/visa')
          }
        }}
      />
    </div>
  )
}
