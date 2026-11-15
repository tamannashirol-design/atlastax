// The AtlasTax API (EXTRACTION-PLAN.md §1). One request handler, used two ways:
//   - in development, mounted inside the Vite dev server (vite.config.ts), so
//     `npm run dev` starts everything with one command
//   - on its own with `npm run server` (server/index.ts)
//
//   POST   /api/files          upload one file (raw body). Headers: x-file-name, x-item-id (optional)
//                              → 201 { fileId, name, size }
//                                413 too big · 415 not a PDF or photo · 403 consent needed
//   DELETE /api/files/:fileId  delete your own file → 204 (404 if it isn't yours)
//   GET    /api/consent        → { given, version, required, at? }  (at = when this session agreed to this version)
//   POST   /api/consent        { version } → 204, records the date and notice version
//   GET    /api/health         → { ok: true }
//
//   Reading (EXTRACTION-PLAN.md; statuses only, never values):
//   GET    /api/extraction?year=2025          → snapshot { capabilities, documents }
//   GET    /api/extraction/events?year=2025   → live updates (server-sent events), snapshot first
//   POST   /api/extraction/:itemId/retry?year=2025 → 204
//   POST   /api/extraction/scenario { scenario }  → 204 (dev only: what the mock does)
//
// Upload headers x-item-id + x-tax-year start reading that document (D4).
//
// Dev test switches on POST /api/files (only when options.dev):
//   ?fail=1 fails halfway · ?kbps=300 another speed · ?dry=1 measure only, nothing stored
//
// Privacy: this file never logs file names, contents, or values. Errors are
// logged by route and error code only.
import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { DEFAULT_OPTIONS, DEV_FINISH_MS, DEV_UPLOAD_KBPS, type ServerOptions } from './config.ts'
import { readingJobs, type ExtractionUpdate } from './extraction/jobs.ts'
import { isScenario, mockProvider, type Scenario } from './extraction/mockProvider.ts'
import { sniff, storage } from './storage.ts'

type Handler = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void

const SESSION_COOKIE = 'atlastax_session'
const SESSION_ID = /^[0-9a-f]{64}$/
const ITEM_ID = /^[a-z0-9-]{1,40}$/
/** A tax year we'd accept (header or query) */
const taxYear = (v: unknown) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : undefined
}

export function createApp(overrides: Partial<ServerOptions> = {}): Handler {
  const options = { ...DEFAULT_OPTIONS, ...overrides }
  const store = storage(options.dataDir)
  // The mock's scenario, per session (dev). One-shot scenarios fail the next uploaded document once.
  const scenarios = new Map<string, { scenario: Scenario; armed: boolean }>()
  const jobs = readingJobs({
    providerFor: (sessionId) =>
      mockProvider(() => {
        const s = scenarios.get(sessionId) ?? { scenario: 'normal' as Scenario, armed: false }
        return { scenario: s.scenario, takeOneShot: () => (s.armed ? ((s.armed = false), true) : false) }
      }),
    filesDir: store.filesDir,
    listFiles: (id) => store.listFiles(id),
  })

  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) {
      if (next) next()
      else send(res, 404, { error: 'not-found' })
      return
    }
    route(req, res, url).catch((err: NodeJS.ErrnoException) => {
      console.error(`[api] ${req.method} ${url.pathname.replace(/[0-9a-f-]{36}/, ':id')} failed:`, err?.code ?? 'error')
      if (!res.headersSent) send(res, 500, { error: 'server' })
    })
  }

  async function route(req: IncomingMessage, res: ServerResponse, url: URL) {
    res.setHeader('cache-control', 'no-store')
    // Requests that change something must come from our own pages
    if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'origin' })
    const sessionId = session(req, res)
    const path = url.pathname

    if (path === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true })

    if (path === '/api/consent') {
      if (req.method === 'GET') {
        const c = await store.consent(sessionId)
        const given = c?.version === options.consentVersion
        return send(res, 200, { given, version: options.consentVersion, required: options.consentRequired, ...(given && c ? { at: c.at } : {}) })
      }
      if (req.method === 'POST') {
        const body = await readJson(req)
        if (body?.version !== options.consentVersion) return send(res, 400, { error: 'version' })
        await store.recordConsent(sessionId, { version: options.consentVersion, at: new Date().toISOString() })
        return send(res, 204)
      }
    }

    if (path === '/api/files' && req.method === 'POST') return upload(req, res, url, sessionId)

    if (path.startsWith('/api/extraction')) return extraction(req, res, url, sessionId)

    const del = path.match(/^\/api\/files\/([^/]+)$/)
    if (del && req.method === 'DELETE') {
      const meta = await store.meta(del[1])
      if (!meta || meta.sessionId !== sessionId) return send(res, 404, { error: 'not-found' })
      await store.remove(meta.fileId)
      jobs.filesChanged(sessionId, meta.year, meta.itemId)
      return send(res, 204)
    }

    return send(res, 404, { error: 'not-found' })
  }

  async function upload(req: IncomingMessage, res: ServerResponse, url: URL, sessionId: string) {
    const dev = options.dev
    const dry = dev && url.searchParams.has('dry')
    // A measured-only dev upload stores nothing, so it needs no consent
    if (!dry && options.consentRequired && (await store.consent(sessionId))?.version !== options.consentVersion) {
      req.resume()
      return send(res, 403, { error: 'consent-required' })
    }
    const declared = Number(req.headers['content-length'] ?? 0)
    if (declared > options.maxFileBytes) {
      res.setHeader('connection', 'close')
      send(res, 413, { error: 'too-big' })
      req.destroy()
      return
    }

    const fail = dev && url.searchParams.has('fail')
    const rate = (dev ? Number(url.searchParams.get('kbps') ?? DEV_UPLOAD_KBPS) : 0) * 1024
    const name = fileName(req.headers['x-file-name'])
    const item = String(req.headers['x-item-id'] ?? '')
    const itemId = ITEM_ID.test(item) ? item : undefined
    const year = taxYear(req.headers['x-tax-year'])

    const file = dry ? null : await store.begin()
    let head = Buffer.alloc(0)
    let received = 0
    let rejected: 413 | 415 | null = null
    let gaveUp = false // we already answered, or the browser went away

    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (rejected) {
          // Keep reading (unthrottled) so the browser gets our answer, but give up on endless bodies
          if (received > options.maxFileBytes * 2) {
            gaveUp = true
            req.destroy()
          }
          return
        }
        if (fail && received > declared / 2) {
          gaveUp = true
          file?.discard()
          send(res, 500, { error: 'test-failure' })
          req.destroy()
          return resolve()
        }
        if (head.length < 16) {
          head = Buffer.concat([head, chunk]).subarray(0, 16)
          if (head.length >= 16 || received === declared) {
            if (!sniff(head)) rejected = 415
          }
        }
        if (received > options.maxFileBytes) rejected = 413
        if (rejected) {
          file?.discard()
          return
        }
        file?.stream.write(chunk)
        if (rate) {
          req.pause()
          setTimeout(() => req.resume(), (chunk.length / rate) * 1000)
        }
      })
      req.on('end', resolve)
      req.on('aborted', () => reject(Object.assign(new Error('aborted'), { code: 'ABORTED' })))
      req.on('error', reject)
    }).catch(async (err) => {
      gaveUp = true
      await file?.discard()
      if ((err as NodeJS.ErrnoException).code !== 'ABORTED') throw err
    })

    if (gaveUp || res.writableEnded) return
    const kind = sniff(head)
    if (rejected || !kind || received === 0) {
      await file?.discard()
      return send(res, rejected === 413 ? 413 : 415, { error: rejected === 413 ? 'too-big' : 'file-type' })
    }

    let fileId = 'dry-run'
    if (file) {
      await new Promise<void>((resolve, reject) => file.stream.end((err?: Error | null) => (err ? reject(err) : resolve())))
      fileId = (await file.keep({ sessionId, itemId, year, name, size: received, kind, createdAt: new Date().toISOString() })).fileId
      jobs.filesChanged(sessionId, year, itemId)
    }
    if (dev) await new Promise((r) => setTimeout(r, DEV_FINISH_MS))
    return send(res, 201, { fileId, name, size: received })
  }

  async function extraction(req: IncomingMessage, res: ServerResponse, url: URL, sessionId: string) {
    const path = url.pathname
    if (path === '/api/extraction/scenario' && req.method === 'POST') {
      if (!options.dev) return send(res, 404, { error: 'not-found' })
      const body = await readJson(req)
      if (!isScenario(body?.scenario)) return send(res, 400, { error: 'scenario' })
      scenarios.set(sessionId, { scenario: body.scenario, armed: true })
      return send(res, 204)
    }
    const year = taxYear(url.searchParams.get('year'))
    if (!year) return send(res, 400, { error: 'year' })

    if (path === '/api/extraction' && req.method === 'GET') return send(res, 200, await jobs.snapshot(sessionId, year))

    if (path === '/api/extraction/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' })
      const write = (u: ExtractionUpdate) => res.write(`data: ${JSON.stringify(u)}\n\n`)
      const stop = jobs.listen(sessionId, year, write)
      write(await jobs.snapshot(sessionId, year))
      const ping = setInterval(() => res.write(': ping\n\n'), 15_000)
      req.on('close', () => {
        clearInterval(ping)
        stop()
      })
      return
    }

    const retry = path.match(/^\/api\/extraction\/([a-z0-9-]{1,40})\/retry$/)
    if (retry && req.method === 'POST') return send(res, jobs.retry(sessionId, year, retry[1]) ? 204 : 404)

    return send(res, 404, { error: 'not-found' })
  }
}

// ---------- helpers ----------

function send(res: ServerResponse, status: number, body?: unknown) {
  if (res.writableEnded) return
  res.statusCode = status
  if (body === undefined) return void res.end()
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/** The session id from our cookie, or a new one (set on the response). */
function session(req: IncomingMessage, res: ServerResponse): string {
  const found = (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === SESSION_COOKIE)?.[1]
  if (found && SESSION_ID.test(found)) return found
  const id = randomBytes(32).toString('hex')
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
  res.setHeader('set-cookie', `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax${secure}`)
  return id
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true // same-origin requests from older browsers, and non-browser tools
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

/** A safe display name: no folders, no control characters, at most 200 characters. */
function fileName(header: string | string[] | undefined): string {
  let name = ''
  try {
    name = decodeURIComponent(String(header ?? ''))
  } catch {
    /* not encoded: ignore */
  }
  name = name
    .split(/[/\\]/)
    .pop()!
    // eslint-disable-next-line no-control-regex -- removing invisible characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 200)
  return name || 'Document'
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 1024) return null
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}
