/**
 * The live tool trace shared by /api/chat (which emits it) and the chat UI (which draws it).
 * Client-safe: no server-only imports.
 *
 * /api/chat answers with newline-delimited JSON. Each line is one TraceEvent; the last is
 * always `done` or `error`.
 */

export type ToolStep = {
  id: string
  name: string
  /** Human label, e.g. `Searching events: "robotics"` — never raw JSON. */
  label: string
  status: 'running' | 'ok' | 'error'
  /** One short line once finished: "3 events · 0.4s" or the error the model saw. */
  summary?: string
  ms?: number
  round: number
}

export type TraceEvent =
  | { type: 'tool_start'; id: string; name: string; label: string; round: number }
  | { type: 'tool_end'; id: string; ok: boolean; ms: number; summary: string }
  | {
      type: 'done'
      text: string
      events: unknown[]
      model: string
      ms: number
      tools: { name: string; ok: boolean; ms: number }[]
    }
  | { type: 'error'; error: string }

function quote(v: unknown, max = 60): string {
  if (typeof v !== 'string' || !v.trim()) return ''
  const s = v.trim()
  return `“${s.length > max ? s.slice(0, max - 1) + '…' : s}”`
}

/** What the assistant is doing, in the student's words. */
export function describeToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'search_events':
      return `Searching campus events ${quote(args.query)}`.trim()
    case 'get_event_details':
      return 'Reading the event details'
    case 'reserve_spot':
      return 'Reserving a spot'
    case 'web_search':
      return `Searching the web ${quote(args.query)}`.trim()
    case 'list_capabilities':
      return 'Checking what tools are available'
    default:
      return name.replace(/_/g, ' ')
  }
}

/** One line for the finished step. Errors are the message the model itself read. */
export function summariseOutcome(name: string, ok: boolean, content: unknown): string {
  const obj = content && typeof content === 'object' ? (content as Record<string, unknown>) : null

  if (!ok) {
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      (obj && typeof obj.error === 'string' && obj.error) ||
      (typeof content === 'string' && content) ||
      'failed'
    return msg.length > 110 ? msg.slice(0, 109) + '…' : msg
  }

  if (name === 'web_search') {
    const n = Array.isArray(obj?.results) ? obj!.results.length : 0
    return n === 1 ? '1 result' : `${n} results`
  }
  if (name === 'reserve_spot') return 'RSVP noted (demo)'
  if (name === 'get_event_details') return 'got it'
  if (name === 'list_capabilities') {
    const n = Array.isArray(obj?.tools) ? obj!.tools.length : 0
    return `${n} tools`
  }

  const list = Array.isArray(content)
    ? content
    : Array.isArray(obj?.hits)
      ? (obj!.hits as unknown[])
      : Array.isArray(obj?.events)
        ? (obj!.events as unknown[])
        : Array.isArray(obj?.results)
          ? (obj!.results as unknown[])
          : null
  if (list) return list.length === 1 ? '1 event' : `${list.length} events`
  return 'done'
}
