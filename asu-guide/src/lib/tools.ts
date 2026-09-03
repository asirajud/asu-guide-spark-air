import 'server-only'

/**
 * asu-guide does not own any tool definitions. It asks asu-tools-api for the OpenAI-shaped tool
 * array once per process and dispatches every tool call back through the same service, so the
 * registry stays the single source of truth for what the assistant can do.
 */

export const TOOLS_BASE = process.env.TOOLS_API_URL ?? 'http://127.0.0.1:5000'

export type OpenAiTool = {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

/** Cached for the life of the process; a registry change needs a dev-server restart. */
let cached: OpenAiTool[] | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000

export async function getTools(): Promise<OpenAiTool[]> {
  if (cached !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    // TypeScript needs explicit narrowing here
    const result = cached as OpenAiTool[]
    return result
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(`${TOOLS_BASE}/openai/tools`, {
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const data = (await res.json()) as { tools?: unknown }

    if (!Array.isArray(data.tools)) {
      throw new Error('Invalid tools response: expected an array')
    }

    const tools = data.tools as OpenAiTool[]
    cached = tools
    cachedAt = Date.now()
    return tools
  } catch (err) {
    if (!process.env.NEXT_PUBLIC_DISABLE_TOOL_WARNINGS) {
      console.warn('Failed to fetch tools from registry:', err)
    }
    cached = null
    return []
  }
}

export type ToolOutcome = { ok: boolean; content: unknown }

export async function callTool(name: string, args: unknown): Promise<ToolOutcome> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)

    const res = await fetch(`${TOOLS_BASE}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()

    if (data.error) {
      throw new Error(data.error.message || 'Unknown tool error')
    }

    // JSON-RPC wraps the payload in `result`; the content array lives inside it,
    // not at the top level.
    const result = data.result ?? data

    if (!Array.isArray(result.content)) {
      throw new Error('Invalid tool response: expected content array')
    }

    const textContent = result.content[0]?.text

    if (!textContent) {
      return { ok: !result.isError, content: '' }
    }

    let parsedContent
    try {
      parsedContent = JSON.parse(textContent)
    } catch {
      parsedContent = textContent
    }

    return { ok: !result.isError, content: parsedContent }
  } catch (err) {
    return {
      ok: false,
      content: {
        error: 'tool_transport',
        message: `Failed to call tool "${name}": ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    }
  }
}

/**
 * Tool results go straight into the model's context, so they are trimmed hard: at most 5
 * events, each with a short blurb. Everything the UI needs to draw a card is kept; the search
 * trace and the raw scores are dropped, because the model cannot use them and they are the
 * bulk of the payload.
 */
export type ToolEvent = {
  id: string
  title: string
  when: string
  club: string
  type: string
  blurb: string
  url: string
}

export function extractEvents(content: unknown): ToolEvent[] {
  if (!content || typeof content !== 'object') {
    return []
  }

  const events: Record<string, unknown>[] = []

  if ('hits' in content && Array.isArray(content.hits)) {
    // Search response
    for (const c of content.hits) {
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        events.push(c)
      }
    }
  } else if ('event' in content) {
    // Reservation
    const record = content as { event?: unknown }
    const evt = record.event
    if (evt && typeof evt === 'object' && !Array.isArray(evt)) {
      const e = evt as Record<string, unknown>
      // read e.id, e.title, e.when, e.club, e.type, e.blurb, e.url through the same
      // defensive string coercion the rest of the function already uses
      if (typeof e.id !== 'string' || typeof e.title !== 'string') {
        return []
      }
      events.push({
        id: e.id,
        title: e.title,
        when: typeof e.when === 'string' ? e.when : '',
        club: typeof e.club === 'string' ? e.club : '',
        type: typeof e.type === 'string' ? e.type : '',
        blurb:
          typeof e.blurb === 'string'
            ? e.blurb.substring(0, 160) + (e.blurb.length > 160 ? '...' : '')
            : '',
        url: typeof e.url === 'string' ? e.url : '',
      })
    } else {
      return []
    }
  } else if (
    'id' in content &&
    typeof content.id === 'string' &&
    'title' in content &&
    typeof content.title === 'string'
  ) {
    // Single event
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      events.push(content)
    }
  } else {
    // Unknown shape
    return []
  }

  return events
    .filter((event) => typeof event.id === 'string' && typeof event.title === 'string')
    .slice(0, 5)
    .map((event) => ({
      id: typeof event.id === 'string' ? event.id : '',
      title: typeof event.title === 'string' ? event.title : '',
      when: typeof event.when === 'string' ? event.when : '',
      club: typeof event.club === 'string' ? event.club : '',
      type: typeof event.type === 'string' ? event.type : '',
      blurb:
        typeof event.blurb === 'string'
          ? event.blurb.substring(0, 160) + (event.blurb.length > 160 ? '...' : '')
          : '',
      url: typeof event.url === 'string' ? event.url : '',
    }))
}

export function summariseForModel(content: unknown, ok: boolean): string {
  if (!ok) {
    const str = JSON.stringify(content)
    return str.length > 600 ? str.substring(0, 600) + '...' : str
  }

  const events = extractEvents(content)
  if (events.length > 0) {
    const result = { events }
    const str = JSON.stringify(result)
    return str.length > 600 ? str.substring(0, 600) + '...' : str
  }

  const str = JSON.stringify(content)
  return str.length > 1200 ? str.substring(0, 1200) + '...' : str
}
