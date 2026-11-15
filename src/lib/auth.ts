// FAKE sign-in state, for testing only. There is no real authentication yet.
// Logged in (the default while developing): "/" is Home. Logged out: "/" is
// the intro page (/welcome always shows it). Switch it with the badge in the
// header, the toggle on /motion, or ?auth=in / ?auth=out in any address.
// Remembered in this browser (localStorage).
import { useSyncExternalStore } from 'react'

const KEY = 'atlastax:fake-auth'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'out'
  } catch {
    return true
  }
}

let loggedIn = read()

export function setLoggedIn(value: boolean) {
  loggedIn = value
  try {
    localStorage.setItem(KEY, value ? 'in' : 'out')
  } catch {
    /* storage blocked: keep in memory */
  }
  listeners.forEach((l) => l())
}

/** Apply ?auth=in / ?auth=out from the address, once, at startup. */
export function applyAuthFlag() {
  const url = new URL(window.location.href)
  const flag = url.searchParams.get('auth')
  if (flag !== 'in' && flag !== 'out') return
  setLoggedIn(flag === 'in')
  url.searchParams.delete('auth')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

export function useLoggedIn(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => loggedIn,
  )
}
