import { useRef } from 'react'
import { frameVars, useFrame } from './frame'
import type { IntroMode } from './chrome'
import type { IntroExit } from './Intro'
import { IntroPhone } from './IntroPhone'
import { IntroWide } from './IntroWide'

// The intro's content, without anything around it: picks the phone or wide
// composition from its own width (see frame.ts).
//   mode "page":   the logged-out entry page ("/", and the /motion preview)
//   mode "replay": inside the <Intro> dialog, from Help on Home
export function IntroContent({ mode, onClose }: { mode: IntroMode; onClose: (how: IntroExit) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useFrame(ref)
  return (
    <div ref={ref} className="h-full bg-background text-text" style={frame ? frameVars(frame) : undefined}>
      {frame && (frame.phone ? <IntroPhone frame={frame} mode={mode} onClose={onClose} /> : <IntroWide frame={frame} mode={mode} onClose={onClose} />)}
    </div>
  )
}
