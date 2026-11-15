// The server keeps each browser's files and consent under a session cookie, set on
// the first request that arrives without one. If several first requests go out at
// once (the live reading status, the consent check, …) each would get a DIFFERENT
// new session, and files could end up in one while the page reads another.
// So every first contact waits for this one small request to settle the cookie.
let ready: Promise<void> | null = null

export function sessionReady(): Promise<void> {
  ready ??= fetch('/api/health', { credentials: 'same-origin' })
    // Read the (tiny) reply, so the request really finishes
    .then((r) => r.text())
    .then(
      () => undefined,
      () => {
        ready = null // offline or odd reply: never block the real request; try again next time
      },
    )
  return ready
}
