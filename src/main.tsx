import { MotionConfig } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user": animations turn off if the OS "Reduce motion" setting is on */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
