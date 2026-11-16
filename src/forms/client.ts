// The browser's side of the downloads: asks the server to fill a form from the confirmed values and hands the
// PDF to the browser's own download. The file is made in memory on the server (never saved or logged there)
// and here it is only a temporary link that is let go right after. Nothing goes into browser storage.
import type { Answers } from '../flow/answers'
import { sessionReady } from '../lib/session'
import { estimateRequest } from '../tax/client'
import type { FormId } from './templates'

export type DownloadResult = 'done' | 'not-ready' | 'failed'

export async function downloadForm(id: FormId, year: number, answers: Answers, numbers: boolean): Promise<DownloadResult> {
  try {
    await sessionReady()
    const r = await fetch(`/api/forms/${id}?year=${year}&numbers=${numbers ? 1 : 0}`, { method: 'POST', body: JSON.stringify(estimateRequest(answers, year)) })
    if (r.status === 409) return 'not-ready'
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/pdf')) return 'failed'
    const blob = await r.blob()
    const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? `AtlasTax-PROTOTYPE-${id}-${year}.pdf`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'done'
  } catch {
    return 'failed'
  }
}
