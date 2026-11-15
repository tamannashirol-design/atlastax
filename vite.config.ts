import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createApp } from './server/app.ts'

// In development the AtlasTax API (server/app.ts) runs inside the Vite dev
// server, so `npm run dev` starts everything with one command. Dev mode turns
// on the upload throttle (so the folder animation gets REAL progress events on
// a fast local connection) and the test switches (?fail=1, ?kbps=300, ?dry=1).
// Not part of the production build.
function api(): Plugin {
  return {
    name: 'atlastax-api',
    configureServer(server) {
      server.middlewares.use(createApp({ dev: true }))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), api()],
})
