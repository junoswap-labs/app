import { Hono } from 'hono'
import relayClaim from './routes/relay-claim'

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))
app.route('/', relayClaim)

const port = Number(process.env.PORT ?? 8787)

Bun.serve({ fetch: app.fetch, port })
console.log(`airdrop relayer listening on :${port}`)
