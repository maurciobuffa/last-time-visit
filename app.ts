import { Hono } from 'https://deno.land/x/hono@v3.11.8/mod.ts'
import { cors, serveStatic } from 'https://deno.land/x/hono@v3.11.8/middleware.ts'
import { streamSSE } from 'https://deno.land/x/hono@v3.11.8/helper/streaming/index.ts'

const db = await Deno.openKv()
const app = new Hono()
let i = 0

interface LastVisit {
  city: string
  country: string
  flag: string
}

app.use(cors())

app.get('/', serveStatic({ path: './index.html' }))


app.post('/visit', async c => {
  const { city, country, flag } = await c.req.json<LastVisit>()

  await db
    .atomic()
    .set(['lastVisit'], {
      city,
      country,
      flag
    })
    .sum(['visits'], 1n)
    .commit()

  return c.json({ message: 'ok' })
})

app.get('/visit', c => {
  return streamSSE(c, async stream => {
    const visitsKey = ['lastVisit']
    const listOfKeysToWatch = [visitsKey]
    const watcher = db.watch(listOfKeysToWatch)

    for await (const entry of watcher) {
      const { value } = entry[0]

      if (value) {
        await stream.writeSSE({
          data: JSON.stringify(value),
          event: 'update',
          id: String(i++)
        })
      }
    }
  })
})

Deno.serve(app.fetch)
