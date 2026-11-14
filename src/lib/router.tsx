// Tiny in-page router: changes the address without reloading, so the app shell
// and stepper stay mounted (and animate) as you move through the flow.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

const EVENT = 'atlastax:navigate'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

export function usePath() {
  return useSyncExternalStore(subscribe, () => window.location.pathname.replace(/\/+$/, '') || '/')
}

/**
 * Go to a path (may end in #id, to link to an item on a page). Keeps debug
 * flags like ?grid=1 in the address. `state` rides along in history (e.g.
 * { fromFlow: true } when the flow opens the Documents page).
 */
export function navigate(path: string, state: Record<string, unknown> | null = null) {
  const [p, hash] = path.split('#')
  window.history.pushState(state, '', p + window.location.search + (hash ? `#${hash}` : ''))
  window.dispatchEvent(new Event(EVENT))
}

const EMPTY_STATE: Record<string, unknown> = {}

/** The history state of the current entry (survives reloads); re-renders when it changes, even on the same path. */
export function useHistoryState(): Record<string, unknown> {
  return useSyncExternalStore(subscribe, () => (window.history.state as Record<string, unknown> | null) ?? EMPTY_STATE)
}

/** A normal link that navigates in-page (Cmd/Ctrl-click still opens a new tab). */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handle} {...rest} />
}
