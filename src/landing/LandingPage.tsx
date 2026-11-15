import { useEffect } from 'react'
import { IntroContent } from '../intro/IntroContent'
import { setLoggedIn } from '../lib/auth'
import { navigate } from '../lib/router'

// The intro as a page: "/" while logged out, and /welcome always.
// Get started and Log in both sign in (FAKE for now) and land on Home, never
// in the questions. TODO confirm: real sign-up / sign-in once accounts exist.
export default function LandingPage() {
  useEffect(() => {
    document.title = 'AtlasTax'
  }, [])
  return (
    <div className="h-dvh">
      <IntroContent
        mode="page"
        onClose={() => {
          setLoggedIn(true)
          navigate('/')
        }}
      />
    </div>
  )
}
