// The browser's side of "Delete my documents". It says "deleted" ONLY when the server answered 200 for the same choice
// (the server checks the disk itself before it does). Only then does it forget the same things in this tab.
import { deleteStoredAnswers } from '../flow/answers'
import type { DeleteScope } from '../flow/deletion'
import { sessionReady } from '../lib/session'

/** Resolves with how many files the server deleted; throws if the server did not confirm (nothing is forgotten here then). */
export async function deleteData(scope: DeleteScope): Promise<number> {
  await sessionReady()
  // Development only: ?fail=1 in the address makes the server pretend it failed (to see the error state)
  const fail = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fail') ? '&fail=1' : ''
  const r = await fetch(`/api/data?scope=${scope}${fail}`, { method: 'DELETE' })
  const body = (r.status === 200 ? await r.json().catch(() => null) : null) as { scope?: string; deleted?: number } | null
  if (!body || body.scope !== scope || typeof body.deleted !== 'number') throw new Error('not-deleted')
  return body.deleted
}

/** After the server confirmed: forget the matching answers in this tab. */
export const forgetAnswers = deleteStoredAnswers
