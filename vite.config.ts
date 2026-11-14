import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Dev-only upload endpoint so the upload animation is driven by REAL progress
// events (bytes the browser has actually sent), not a timer.
//   POST /api/upload            reads the body at ~600 KB/s, then responds
//   POST /api/upload?fail=1     fails halfway (for the error state)
//   POST /api/upload?kbps=300   other speeds
// The 400ms pause before responding stands in for the server processing the
// file (the "finishing" moment). Not part of the production build.
function devUpload(): Plugin {
  return {
    name: 'dev-upload',
    configureServer(server) {
      server.middlewares.use('/api/upload', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const query = new URL(req.url ?? '/', 'http://localhost').searchParams
        const fail = query.has('fail')
        const rate = Number(query.get('kbps') ?? 600) * 1024
        const total = Number(req.headers['content-length'] ?? 0)
        let received = 0
        req.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (fail && received > total / 2 && !res.writableEnded) {
            res.statusCode = 500
            res.end('Upload failed')
            req.destroy()
            return
          }
          req.pause()
          setTimeout(() => req.resume(), (chunk.length / rate) * 1000)
        })
        req.on('end', () => {
          if (res.writableEnded) return
          setTimeout(() => {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, bytes: received }))
          }, 400)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devUpload()],
})
