// Remembers that the first-run intro was seen, in this browser. A per-viewer
// convenience only: if storage is blocked, the intro simply shows again.
//
// To see the intro again (testing): open /?intro=reset (clears this and shows
// it), use "Replay intro" on Home, or the Intro section on /motion.
const KEY = 'atlastax:intro-seen'

export function introSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* storage blocked: nothing to remember */
  }
}

export function resetIntro() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage blocked */
  }
}
