import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Intro } from '../intro/Intro'
import { navigate } from '../lib/router'

// Profile (the Profile tab). For now: "Replay intro" (moved here from Home).
// TODO: account details once accounts exist.
const linkClass =
  'flex min-h-11 items-center self-start rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export default function ProfilePage() {
  const [intro, setIntro] = useState(false)
  const replay = useRef<HTMLButtonElement>(null)
  const after = useRef<() => void>(() => {})
  useEffect(() => {
    document.title = 'Profile · AtlasTax'
  }, [])
  return (
    <AppShell title="Profile" activeTab="profile">
      <div className="page-x">
        <div className="page-content page-grid pt-8 pb-12">
          <div className="col-span-full flex flex-col gap-6 tablet:col-span-6 tablet:col-start-2 desktop:col-start-4">
            <h1 className="font-display text-display">Profile</h1>
            <section aria-labelledby="profile-help" className="flex flex-col gap-1 rounded-lg bg-surface p-6 shadow-1">
              <h2 id="profile-help" className="font-display text-title">
                Help
              </h2>
              <p className="text-body text-text-muted">See how AtlasTax works again.</p>
              <button ref={replay} type="button" onClick={() => setIntro(true)} className={linkClass}>
                Replay intro
              </button>
            </section>
          </div>
        </div>
      </div>
      <AnimatePresence onExitComplete={() => after.current()}>
        {intro && (
          <Intro
            onClose={(how) => {
              setIntro(false)
              // Get started goes to Home; otherwise focus returns to Replay intro
              after.current = how === 'start' ? () => navigate('/') : () => replay.current?.focus()
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  )
}
