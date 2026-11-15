import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { useConsent } from '../consent/client'
import { ConsentSheet } from '../consent/ConsentSheet'
import { Intro } from '../intro/Intro'
import { navigate } from '../lib/router'

// Profile (the Profile tab). For now: "Replay intro" (moved here from Home) and
// the privacy notice people agree to before their first upload (read-only here).
// TODO: account details once accounts exist.
const linkClass =
  'flex min-h-11 items-center self-start rounded-sm text-body font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export default function ProfilePage() {
  const [intro, setIntro] = useState(false)
  const [notice, setNotice] = useState(false)
  const consent = useConsent()
  const noticeButton = useRef<HTMLButtonElement>(null)
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
            <section aria-labelledby="profile-privacy" className="flex flex-col gap-1 rounded-lg bg-surface p-6 shadow-1">
              <h2 id="profile-privacy" className="font-display text-title">
                Privacy
              </h2>
              <p className="text-body text-text-muted">How AtlasTax uses the documents you add.</p>
              {consent.status === 'ready' && consent.required && (
                <p className="text-small text-text-muted">
                  {consent.given && consent.at ? `You agreed on ${new Date(consent.at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}.` : 'You’ll be asked before you add your first document.'}
                </p>
              )}
              <button ref={noticeButton} type="button" onClick={() => setNotice(true)} className={linkClass}>
                Read the privacy notice
              </button>
            </section>
          </div>
        </div>
      </div>
      <AnimatePresence onExitComplete={() => noticeButton.current?.focus()}>
        {notice && <ConsentSheet mode="read" onClose={() => setNotice(false)} />}
      </AnimatePresence>
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
