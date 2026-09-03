import { allTools, findTool, listServices, SESSION_TOOLS, type ToolSpec } from './registry.js'
import { validateArgs, describeSchema } from './validate.js'
import { dispatch, checkHealth } from './dispatch.js'

export type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown }
export type JsonRpcResponse = { jsonrpc: '2.0'; id: string | number | null } & ({ result: unknown } | { error: { code: number; message: string; data?: unknown } })

export const PROTOCOL_VERSION = '2025-06-18'
export const SERVER_INFO = { name: 'asu-tools-api', version: '1.0.0' }

/** JSON-RPC error codes, per the MCP spec's use of the standard set. */
const PARSE_ERROR = -32700, INVALID_REQUEST = -32600, METHOD_NOT_FOUND = -32601,
      INVALID_PARAMS = -32602, INTERNAL_ERROR = -32603

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0' as const, id, result }
}

function fail(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0' as const, id, error: { code, message, data } }
}

/**
 * The virtual tool. It is not owned by any registered service: it is answered inside this
 * process, and it exists so that the session-start tool budget can stay at three. Everything the
 * registry knows about is discoverable through it without being re-sent on every turn.
 */
export const LIST_CAPABILITIES: ToolSpec = {
  name: 'list_capabilities',
  description: 'List every tool this assistant can reach beyond the ones already loaded, with the service that owns each.',
  route: { method: 'GET', path: '/__internal/list_capabilities' },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
}

export function sessionTools(): ToolSpec[] {
  return SESSION_TOOLS
    .map(name => findTool(name))
    .filter(Boolean)
    .map(entry => entry!.tool)
    .concat(LIST_CAPABILITIES)
}

export function toOpenAiTools(specs: ToolSpec[]): unknown[] {
  return specs.map(spec => ({
    type: 'function',
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.inputSchema
    }
  }))
}

async function callListCapabilities(): Promise<unknown> {
  return {
    tools: allTools().map(({ service, tool }) => ({
      name: tool.name, service: service.id, description: tool.description,
      parameters: describeSchema(tool),
      loaded_at_session_start: SESSION_TOOLS.includes(tool.name),
    })),
    services: await Promise.all(listServices().map((s) => checkHealth(s))),
  }
}

export async function callTool(name: string, args: unknown): Promise<{ ok: boolean; content: unknown }> {
  if (name === 'list_capabilities') {
    return { ok: true, content: await callListCapabilities() }
  }

  const entry = findTool(name)
  if (!entry) {
    return {
      ok: false,
      content: {
        error: 'unknown_tool',
        message: `There is no tool named "${name}". Call list_capabilities to see what is available.`
      }
    }
  }

  const check = validateArgs(entry.tool, args)
  if (!check.ok) {
    return {
      ok: false,
      content: {
        error: 'invalid_arguments',
        tool: name,
        message: check.summary,
        fields: check.errors
      }
    }
  }

  const result = await dispatch(entry, args as Record<string, unknown>)
  if (result.ok) {
    return { ok: true, content: result.data }
  } else {
    return {
      ok: false,
      content: {
        error: result.code,
        service: result.service,
        status: result.status,
        message: result.message
      }
    }
  }
}

export async function handleJsonRpc(body: unknown): Promise<JsonRpcResponse | null> {
  const req = body as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
  const id = (typeof req.id === 'string' || typeof req.id === 'number') ? req.id : null
  
  if (!req || typeof req !== 'object' || !req.method || typeof req.method !== 'string') {
    return fail(null, INVALID_REQUEST, 'Invalid request: missing method')
  }

  const { method, params } = req

  // A request WITHOUT an `id` is a notification: perform no work and return null
  if (id === undefined || id === null) {
    // MCP sends `notifications/initialized` this way
    return null
  }

  try {
    switch (method) {
      case 'initialize': {
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO
        })
      }
      case 'ping': {
        return ok(id, {})
      }
      case 'tools/list': {
        return ok(id, {
          tools: [...sessionTools()].map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }))
        })
      }
      case 'tools/call': {
        const p = (params ?? {}) as { name?: unknown; arguments?: unknown }
        if (!p || typeof p !== 'object' || typeof p.name !== 'string') {
          return fail(id, INVALID_PARAMS, 'tools/call requires params.name')
        }
        const { name, arguments: args } = p
        const r = await callTool(name as string, args ?? {})
        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(r.content) }],
          isError: !r.ok,
        })
      }
      default: {
        return fail(id, METHOD_NOT_FOUND, `Unknown method "${method}"`)
      }
    }
  } catch (error: unknown) {
    return fail(id, INTERNAL_ERROR, (error as Error).message || 'Internal error')
  }
}

export { PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS, INTERNAL_ERROR }