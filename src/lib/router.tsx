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

/** Go to a path. Keeps debug flags like ?grid=1 in the address. */
export function navigate(path: string) {
  window.history.pushState(null, '', path + window.location.search)
  window.dispatchEvent(new Event(EVENT))
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
