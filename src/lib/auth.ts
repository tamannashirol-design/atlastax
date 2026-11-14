// FAKE sign-in state, for testing only. There is no real authentication yet.
// Logged out (the default): "/" is the intro page. Logged in: "/" is Home.
// Switch it with the toggle on /motion, or ?auth=in / ?auth=out in any
// address (remembered in this browser, then removed from the address).
import { useSyncExternalStore } from 'react'

const KEY = 'atlastax:fake-auth'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'in'
  } catch {
    return false
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
