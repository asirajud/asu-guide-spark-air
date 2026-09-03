// Node.js HTTP server implementing MCP and registry APIs
// Direct use of node:http instead of web frameworks
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { handleJsonRpc, sessionTools, toOpenAiTools, callTool } from './mcp.js'
import {
  listServices,
  upsertService,
  removeService,
  allTools,
  reloadRegistry,
  ContractError,
} from './registry.js'
import { checkHealth } from './dispatch.js'
import { clearValidatorCache } from './validate.js'

const PORT = Number(process.env.PORT ?? 5000)

// Helper to send JSON responses with CORS headers
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(body))
}

// Helper to read and parse JSON request body
async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    const MAX_BODY_SIZE = 200_000

    req.on('data', (chunk) => {
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error('BodyTooLarge'))
        req.destroy()
        return
      }
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        if (body === '') {
          resolve({})
        } else {
          resolve(JSON.parse(body))
        }
      } catch (err) {
        reject(err)
      }
    })

    req.on('error', reject)
  })
}

// CORS preflight handler
function handleOptions(res: ServerResponse, methods: string, headers: string) {
  res.writeHead(204, {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': headers,
  })
  res.end()
}

// Main server logic
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*')

  const url = new URL(req.url!, `http://${req.headers.host}`)
  const path = url.pathname

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    if (path === '/mcp') {
      handleOptions(
        res,
        'GET,POST,DELETE,OPTIONS',
        'Content-Type, Mcp-Session-Id, MCP-Protocol-Version',
      )
    } else {
      handleOptions(res, 'GET,POST,DELETE,OPTIONS', 'Content-Type')
    }
    return
  }

  // Handle /health
  if (req.method === 'GET' && path === '/health') {
    const services = listServices()
    json(res, 200, {
      ok: true,
      service: 'asu-tools-api',
      services: services.length,
      tools: allTools().length,
      sessionTools: sessionTools().map((t) => t.name),
    })
    return
  }

  // Handle /mcp endpoint
  if (req.method === 'POST' && path === '/mcp') {
    try {
      const body = await readJson(req)
      const out = await handleJsonRpc(body)

      if (out === null) {
        // Notification, respond with 202
        res.writeHead(202)
        res.end()
      } else {
        // Regular response
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(out))
      }
    } catch (err) {
      // Handle JSON-RPC parse error
      if (err instanceof SyntaxError) {
        json(res, 200, {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        })
      } else {
        // Other errors
        console.error('Error in /mcp:', err)
        json(res, 500, { error: (err as Error).message })
      }
    }
    return
  }

  // Handle GET /mcp (405)
  if (req.method === 'GET' && path === '/mcp') {
    json(res, 405, {
      error: 'Method not allowed',
      message:
        'This deployment implements the POST-only variant of the Streamable HTTP transport (no SSE stream).',
    })
    return
  }

  // Handle /openai/tools
  if (req.method === 'GET' && path === '/openai/tools') {
    json(res, 200, { tools: toOpenAiTools(sessionTools()) })
    return
  }

  // Handle /registry/services
  if (req.method === 'GET' && path === '/registry/services') {
    const services = listServices()
    const health = await Promise.all(services.map(checkHealth))
    json(res, 200, { services, health })
    return
  }

  // Handle POST /registry/services
  if (req.method === 'POST' && path === '/registry/services') {
    try {
      const body = await readJson(req)
      const result = upsertService(body)
      // Validators are cached by tool name, so a re-registered service with a
      // changed schema would keep being checked against the old one.
      clearValidatorCache()
      const status = result.created ? 201 : 200
      json(res, status, {
        service: result.service,
        created: result.created,
        tools: result.service.tools.map((t) => t.name),
      })
    } catch (err) {
      if (err instanceof ContractError) {
        json(res, 400, { error: 'invalid_contract', message: err.message })
      } else {
        console.error('Error in /registry/services:', err)
        json(res, 500, { error: (err as Error).message })
      }
    }
    return
  }

  // Handle DELETE /registry/services/:id
  if (req.method === 'DELETE' && path.startsWith('/registry/services/')) {
    const id = path.split('/').pop()!
    try {
      const removed = removeService(id)
      clearValidatorCache()
      if (removed) {
        json(res, 200, { removed: true, id })
      } else {
        json(res, 404, { error: 'unknown_service', id })
      }
    } catch (err) {
      console.error('Error in /registry/services/:id:', err)
      json(res, 500, { error: (err as Error).message })
    }
    return
  }

  // Handle POST /registry/reload
  if (req.method === 'POST' && path === '/registry/reload') {
    reloadRegistry()
    const services = listServices()
    json(res, 200, { ok: true, services: services.length })
    return
  }

  // Handle POST /tools/:name
  if (req.method === 'POST' && path.startsWith('/tools/')) {
    const name = path.split('/').pop()!
    try {
      const args = await readJson(req)
      const r = await callTool(name, args)
      if (r.ok) {
        json(res, 200, r.content)
      } else {
        json(res, 400, r.content)
      }
    } catch (err) {
      console.error('Error in /tools/:name:', err)
      json(res, 500, { error: (err as Error).message })
    }
    return
  }

  // Default 404
  json(res, 404, { error: 'not found' })
})

// Start server
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[asu-tools-api] MCP + registry on http://127.0.0.1:${PORT}`)

  // Log registered services
  const services = listServices()
  for (const { id, baseUrl } of services) {
    const n = allTools().filter((t) => t.service.id === id).length
    console.log(`  registered ${id} -> ${baseUrl} (${n} tools)`)
  }
})

// Note: Port 5000 is also used by macOS AirPlay Receiver on *:5000,
// which is why this binds 127.0.0.1 explicitly rather than 0.0.0.0.
