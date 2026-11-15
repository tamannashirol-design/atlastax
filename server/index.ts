// Runs the API on its own (not needed for `npm run dev`, which mounts it inside
// the Vite dev server). Run: npm run server   (PORT=8787 by default)
// Dev switches stay off here unless ATLASTAX_DEV=1.
import { createServer } from 'node:http'
import { createApp } from './app.ts'

const port = Number(process.env.PORT ?? 8787)
const app = createApp({ dev: process.env.ATLASTAX_DEV === '1' })
createServer((req, res) => app(req, res)).listen(port, () => console.log(`AtlasTax API on http://localhost:${port}`))
