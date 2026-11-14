import { useRef } from 'react'
import { frameVars, useFrame } from './frame'
import type { IntroExit } from './Intro'
import { IntroPhone } from './IntroPhone'
import { IntroWide } from './IntroWide'

// The intro's content, without the dialog around it: picks the phone or wide
// composition from its own width (see frame.ts). Used full-screen by <Intro>
// and inside the scaled device frames on /motion.
export function IntroContent({ onClose }: { onClose: (how: IntroExit) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useFrame(ref)
  return (
    <div ref={ref} className="h-full bg-background text-text" style={frame ? frameVars(frame) : undefined}>
      {frame && (frame.phone ? <IntroPhone frame={frame} onClose={onClose} /> : <IntroWide frame={frame} onClose={onClose} />)}
    </div>
  )
}
