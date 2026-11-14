import { MotionConfig } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyAuthFlag } from './lib/auth'

// Testing only: ?auth=in / ?auth=out switches the fake sign-in state
applyAuthFlag()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user": animations turn off if the OS "Reduce motion" setting is on */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
