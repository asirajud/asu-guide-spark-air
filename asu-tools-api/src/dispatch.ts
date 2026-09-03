import type { RegisteredTool } from './registry.js'

/**
 * The registry must survive a service being down: a dead upstream produces a structured error
 * envelope the model can read and explain, never an unhandled throw and never a bare 500.
 */

export const DISPATCH_TIMEOUT_MS = Number(process.env.DISPATCH_TIMEOUT_MS ?? 20_000)

export type DispatchOk = { ok: true; status: number; data: unknown; ms: number }
export type DispatchErr = {
  ok: false
  /** machine-readable so a caller can branch: 'unreachable' | 'timeout' | 'upstream_error' | 'bad_response' */
  code: 'unreachable' | 'timeout' | 'upstream_error' | 'bad_response'
  status: number | null
  message: string
  service: string
  ms: number
}
export type DispatchResult = DispatchOk | DispatchErr

export function buildUrl(entry: RegisteredTool, args: Record<string, unknown>): { url: string; body: Record<string, unknown> | null } {
  const { tool, service } = entry
  let path = tool.route.path
  const body: Record<string, unknown> = { ...args }
  
  // Handle path parameters
  const pathParamRegex = /:([^/]+)/g
  let match
  while ((match = pathParamRegex.exec(path)) !== null) {
    const paramName = match[1]
    const paramValue = body[paramName]
    if (paramValue !== undefined) {
      path = path.replace(`:${paramName}`, encodeURIComponent(String(paramValue)))
      delete body[paramName]
    }
  }
  
  // Construct URL
  let url = service.baseUrl
  if (url.endsWith('/')) {
    url = url.slice(0, -1)
  }
  url += path
  
  // Handle query params or body
  const finalBody: Record<string, unknown> | null =
    entry.tool.route.method === 'GET' ? null : body
  
  if (entry.tool.route.method === 'GET') {
    // Add remaining params as query string
    const queryParams = Object.entries(body)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')
    
    if (queryParams) {
      url += `?${queryParams}`
    }
  }
  
  return { url, body: finalBody }
}

export async function dispatch(entry: RegisteredTool, args: Record<string, unknown>): Promise<DispatchResult> {
  const { url, body } = buildUrl(entry, args)
  const { service } = entry
  
  const start = performance.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS)
    
    const res = await fetch(url, {
      method: entry.tool.route.method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const ms = performance.now() - start
    
    if (!res.ok) {
      let errorMessage = ''
      try {
        const parsed = (await res.json()) as unknown
        const upstreamError =
          parsed && typeof parsed === 'object' && 'error' in parsed &&
          typeof (parsed as { error?: unknown }).error === 'string'
            ? (parsed as { error: string }).error
            : null
        if (upstreamError) {
          errorMessage = upstreamError
        } else {
          errorMessage = String(parsed)
        }
      } catch {
        errorMessage = await res.text()
        if (errorMessage.length > 300) {
          errorMessage = errorMessage.substring(0, 300)
        }
      }
      
      return {
        ok: false,
        code: 'upstream_error',
        status: res.status,
        message: errorMessage,
        service: entry.service.id,
        ms
      }
    }
    
    let data: unknown
    try {
      data = await res.json()
    } catch {
      return {
        ok: false,
        code: 'bad_response',
        status: res.status,
        message: 'Response is not valid JSON',
        service: entry.service.id,
        ms
      }
    }
    
    return {
      ok: true,
      status: res.status,
      data,
      ms
    }
  } catch (err: unknown) {
    const ms = performance.now() - start
    
    // Parenthesised deliberately: without it this reads as (a && b) || c, and
    // the right side dereferences a possibly-null err, throwing inside catch.
    const name =
      err && typeof err === 'object' && 'name' in err ? (err as { name: string }).name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return {
        ok: false,
        code: 'timeout',
        status: null,
        message: `${entry.service.id} did not answer within ${DISPATCH_TIMEOUT_MS}ms.`,
        service: entry.service.id,
        ms
      }
    }
    
    return {
      ok: false,
      code: 'unreachable',
      status: null,
      message: `${entry.service.id} is not reachable at ${service.baseUrl} (${err instanceof Error ? err.message : String(err)}).`,
      service: entry.service.id,
      ms
    }
  }
}

export async function checkHealth(service: { id: string; baseUrl: string; healthPath: string }): Promise<{ id: string; healthy: boolean; ms: number; detail?: string }> {
  const start = performance.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    const res = await fetch(`${service.baseUrl}${service.healthPath}`, {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const ms = performance.now() - start
    
    return {
      id: service.id,
      healthy: res.ok,
      ms,
      detail: res.ok ? undefined : await res.text()
    }
  } catch (err: unknown) {
    const ms = performance.now() - start
    
    return {
      id: service.id,
      healthy: false,
      ms,
      detail: err instanceof Error ? err.message : String(err)
    }
  }
}