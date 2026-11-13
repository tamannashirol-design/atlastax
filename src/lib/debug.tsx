// Debug tooling: grid overlay + outline-everything, available on every screen.
// Turn on with ?grid=1 and/or ?outlines=1 in the address bar.
import { useEffect, useState, type ReactNode } from 'react'

export function useUrlFlag(name: string) {
  const [on, setOn] = useState(() => new URLSearchParams(window.location.search).get(name) === '1')
  useEffect(() => {
    const url = new URL(window.location.href)
    if (on) url.searchParams.set(name, '1')
    else url.searchParams.delete(name)
    window.history.replaceState(null, '', url)
  }, [name, on])
  return [on, setOn] as const
}

function GridOverlay() {
  return (
    <div aria-hidden className="scroll-gutter pointer-events-none z-20 page-x [grid-area:1/1]">
      <div className="page-content page-grid h-full">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className={`grid-overlay-col ${i >= 8 ? 'hidden desktop:block' : i >= 4 ? 'hidden tablet:block' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

// Stacks the page and the overlay in the same grid cell (no absolute positioning).
export function DebugStack({ grid, outlines, children }: { grid: boolean; outlines: boolean; children: ReactNode }) {
  return (
    <div className={`grid min-h-dvh grid-cols-1 ${outlines ? 'debug-outlines' : ''}`}>
      <div className="flex min-w-0 flex-col [grid-area:1/1]">{children}</div>
      {grid && <GridOverlay />}
    </div>
  )
}
