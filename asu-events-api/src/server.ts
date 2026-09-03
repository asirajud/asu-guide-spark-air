// This service uses node:http directly instead of a web framework because
// the whole surface is five routes, so a framework would be more dependency than the service.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { eq, desc, sql, isNotNull } from 'drizzle-orm'
import { db, migrate } from './db/index.js'
import { events, reservations } from './db/schema.js'
import { search, getEvent } from './search.js'

type SearchBody = { query?: unknown; days_ahead?: unknown; type?: unknown; limit?: unknown }
type ReservationBody = { event_id?: unknown; asurite?: unknown }

const PORT = Number(process.env.PORT ?? 5001)

// Helper to send JSON responses with CORS headers
function json(res: ServerResponse, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.writeHead(status)
  res.end(JSON.stringify(body))
}

// Helper to read and parse JSON body
class BodyTooLarge extends Error {}
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 100_000) throw new BodyTooLarge('request body too large')
    chunks.push(chunk as Buffer)
  }
  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

// Handle OPTIONS requests with CORS headers
function handleOptions(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.writeHead(204)
  res.end()
}

// Route handlers
async function handleHealth(req: IncomingMessage, res: ServerResponse) {
  const [eventsCount, embeddedCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(events),
    db.select({ count: sql<number>`count(*)` }).from(events).where(isNotNull(events.embedding)),
  ])
  json(res, 200, {
    ok: true,
    service: 'asu-events-api',
    events: eventsCount[0].count,
    embedded: embeddedCount[0].count,
    now: new Date().toISOString(),
  })
}

async function handleSearch(req: IncomingMessage, res: ServerResponse) {
  const body = (await readJson(req)) as SearchBody
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) {
    json(res, 400, { error: 'query is required and must be a non-empty string' })
    return
  }

  const filters = {
    daysAhead: typeof body.days_ahead === 'number' ? body.days_ahead : undefined,
    type: typeof body.type === 'string' && body.type.trim() ? body.type.trim() : undefined,
    limit: typeof body.limit === 'number' ? body.limit : undefined,
  }

  const result = await search(query, filters)
  json(res, 200, result)
}

async function handleGetEvent(req: IncomingMessage, res: ServerResponse, id: string) {
  const event = await getEvent(id)
  if (!event) {
    json(res, 404, { error: 'event not found' })
    return
  }
  json(res, 200, event)
}

async function handleReserve(req: IncomingMessage, res: ServerResponse) {
  const body = (await readJson(req)) as ReservationBody
  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : ''
  const asurite = typeof body.asurite === 'string' ? body.asurite.trim().toLowerCase() : ''

  if (!eventId) {
    json(res, 400, { error: 'event_id is required and must be a non-empty string' })
    return
  }

  if (!asurite) {
    json(res, 400, { error: 'asurite is required and must be a non-empty string' })
    return
  }

  const event = await getEvent(eventId)
  if (!event) {
    json(res, 404, { error: 'event not found' })
    return
  }

  const id = `res_${randomUUID().slice(0, 8)}`
  const now = new Date()
  await db.insert(reservations).values({
    id,
    eventId,
    asurite,
    createdAt: now,
  })

  json(res, 201, {
    reservation_id: id,
    event_id: eventId,
    asurite,
    event: event,
    status: 'confirmed',
    mock: true,
    notice: 'This is a mock reservation stored only in this demo database. Nothing was sent to Sun Devil Central and no real seat has been held.',
  })
}

async function handleGetReservations(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`)
  const asurite = url.searchParams.get('asurite')

  if (!asurite) {
    json(res, 400, { error: 'asurite query parameter is required' })
    return
  }

  const rows = await db.select().from(reservations).where(eq(reservations.asurite, asurite)).orderBy(desc(reservations.createdAt))

  const reservationsWithEvents = await Promise.all(
    rows.map(async (row) => {
      const event = await getEvent(row.eventId)
      return {
        reservation_id: row.id,
        created_at: row.createdAt.toISOString(),
        event: event ? event : null,
      }
    })
  )

  json(res, 200, {
    asurite,
    count: rows.length,
    reservations: reservationsWithEvents,
    mock: true,
  })
}

// Main server logic
async function main() {
  await migrate()
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const path = url.pathname
    const method = req.method

    if (method === 'OPTIONS') {
      handleOptions(res)
      return
    }

    try {
      if (method === 'GET' && path === '/health') {
        await handleHealth(req, res)
      } else if (method === 'POST' && path === '/search') {
        await handleSearch(req, res)
      } else if (method === 'GET' && path.startsWith('/events/')) {
        const id = decodeURIComponent(path.slice('/events/'.length))
        if (!id) { json(res, 404, { error: 'event not found' }); return }
        await handleGetEvent(req, res, id)
      } else if (method === 'POST' && path === '/reservations') {
        await handleReserve(req, res)
      } else if (method === 'GET' && path === '/reservations') {
        await handleGetReservations(req, res)
      } else {
        json(res, 404, { error: 'not found' })
      }
    } catch (err) {
      if (err instanceof BodyTooLarge) {
        json(res, 413, { error: 'request body too large' })
        return
      }
      if (err instanceof SyntaxError) {
        json(res, 400, { error: 'invalid JSON body' })
        return
      }
      console.error(err)
      json(res, 500, { error: (err as Error).message })
    }
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[asu-events-api] listening on http://127.0.0.1:${PORT}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})