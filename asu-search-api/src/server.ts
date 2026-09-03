// node:http directly — the surface is three routes, so a framework would be
// more dependency than service. Mirrors asu-events-api's conventions.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { isConfigured, SearchNotConfigured, webSearch } from './brave.js'

const PORT = Number(process.env.PORT ?? 5003)

function json(res: ServerResponse, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.writeHead(status)
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 100_000) throw new Error('request body too large')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * The tool contract this service publishes to asu-tools-api. Kept beside the
 * implementation so the schema and the handler cannot drift apart.
 */
export const TOOLS = [
  {
    name: 'web_search',
    description:
      'Search the public web for current information that is not in the ASU events data — news, official ASU pages, deadlines, or anything happening off campus. Prefer search_events for campus events.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for, in plain language.' },
        count: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'How many results to return. Default 5.',
        },
        freshness: {
          type: 'string',
          enum: ['pd', 'pw', 'pm', 'py'],
          description: 'Restrict to the past day, week, month or year.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
]

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.writeHead(204)
    return res.end()
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'asu-search-api',
      configured: isConfigured(),
      tools: TOOLS.map((t) => t.name),
    })
  }

  // Served so the registry can pull the contract rather than duplicating it.
  if (req.method === 'GET' && url.pathname === '/tools') {
    return json(res, 200, { tools: TOOLS })
  }

  if (req.method === 'POST' && url.pathname === '/search') {
    let body: { query?: unknown; count?: unknown; freshness?: unknown }
    try {
      body = (await readJson(req)) as typeof body
    } catch {
      return json(res, 400, { error: 'Expected a JSON body.' })
    }

    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) return json(res, 400, { error: 'query is required.' })

    const count = typeof body.count === 'number' ? body.count : 5
    const freshness = typeof body.freshness === 'string' ? body.freshness : undefined

    const started = Date.now()
    try {
      const results = await webSearch(query, count, freshness)
      return json(res, 200, { query, results, ms: Date.now() - started })
    } catch (err) {
      if (err instanceof SearchNotConfigured) {
        // A missing key is a deployment problem, not a runtime failure — say so
        // plainly so the registry can report the service as unconfigured.
        return json(res, 503, { error: 'Web search is not configured on this server.' })
      }
      console.error('[search]', err instanceof Error ? err.message : err)
      return json(res, 502, { error: 'Web search is unavailable right now.' })
    }
  }

  json(res, 404, { error: 'Not found.' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`asu-search-api listening on http://127.0.0.1:${PORT}`)
})
