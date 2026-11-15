import { setLoggedIn, useLoggedIn } from '../lib/auth'

// Testing only: shows the FAKE sign-in state in the header and switches it.
// Remove once real accounts exist.
export function FakeAuthBadge() {
  const loggedIn = useLoggedIn()
  return (
    <button
      type="button"
      onClick={() => setLoggedIn(!loggedIn)}
      aria-label={`${loggedIn ? 'Logged in' : 'Logged out'} (fake, for testing). Switch to ${loggedIn ? 'logged out' : 'logged in'}`}
      className="flex min-h-11 shrink-0 items-center rounded-full text-small whitespace-nowrap text-text-muted underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
    >
      {loggedIn ? 'Logged in (fake)' : 'Logged out (fake)'}
    </button>
  )
}
