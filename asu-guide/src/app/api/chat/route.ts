import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'
import { getTools, callTool, extractEvents, summariseForModel, type ToolEvent } from '@/lib/tools'
import { describeToolCall, summariseOutcome, type TraceEvent } from '@/lib/tool-trace'

export const runtime = 'nodejs'
export const maxDuration = 60
const MAX_TURNS = 24
/** Bounded so one user turn cannot fan out into an unbounded chain of tool calls. */
const MAX_TOOL_ROUNDS = 3

type Incoming = { role: 'user' | 'assistant'; content: string; kind?: string }
type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

function contextualise(m: Incoming): ChatMessage {
  if (m.role === 'assistant' && m.kind === 'vision') {
    return {
      role: 'assistant',
      content: `[Media the student shared earlier, as read by an ASU AIR vision or speech model]: ${m.content}`,
    }
  }
  return { role: m.role, content: m.content }
}

function systemPrompt(asurite: string | null, hasTools: boolean): string {
  let prompt = `You are Sol, a campus assistant named after Sol, the ASU supercomputer you run on. You are a campus assistant for Arizona State University students, running on the ASU AIR platform.
Be concise: one to three short sentences unless the student asks for detail. Never use markdown headings or bullet lists.`
  if (asurite) {
    prompt += `\nThe signed-in student's ASURITE is ${asurite}. Greet them by it the first time you speak in a conversation, then stop repeating it.`
  } else {
    prompt += `\nNobody is signed in, so do not guess the student's name, and if they ask to reserve a spot, tell them they need to sign in first.`
  }
  prompt += `\n[Media the student shared earlier, as read by an ASU AIR vision or speech model]: `
  if (hasTools) {
    prompt += `\nYou have tools for finding real ASU events. Call search_events whenever the student asks what is on, what to do, or about anything happening on campus — never answer from memory, because you do not have the event calendar in your context. Call reserve_spot only when the student clearly asks to be signed up for a specific event, and only when you know their ASURITE. Never invent an event, a date, a location or an event id: every id you pass to another tool must have come back from search_events in this conversation. When a tool returns an error naming a field, fix that field and call it again rather than apologising to the student.`
    prompt += `\nA reservation made with reserve_spot is a demo record in this app's own database: it does not contact Sun Devil Central, no seat is actually held, and nothing is emailed. Never tell the student to expect a confirmation email, a text, a calendar invite or a link to join, and never say a spot has been held with the club or with ASU. Say that you have noted the RSVP here, and point them at the event's own page to sign up for real.`
  } else {
    prompt += `\nYou have no access to the live event calendar right now, so say plainly that you cannot look events up rather than guessing.`
  }
  return prompt
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  // Only user and assistant turns are accepted. Passing role through verbatim
  // would let a client post role:"system" and prepend its own instructions
  // ahead of the tool policy.
  const incoming = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m: unknown): m is { role: 'user' | 'assistant'; content: string; kind?: string } => {
      if (!m || typeof m !== 'object') return false
      const t = m as { role?: unknown; content?: unknown }
      return (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string'
    },
  )
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No messages supplied.' }, { status: 400 })
  }

  // Identity comes from the signed session, never from the request body — a
  // client-supplied ASURITE would let anyone be greeted as, and reserve on
  // behalf of, another student.
  const session = await getSession()
  const asurite = session?.asurite ?? null

  const tools = await getTools()
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(asurite, tools.length > 0) },
    ...incoming.slice(-MAX_TURNS).map(contextualise),
  ]

  // The answer is streamed as newline-delimited JSON so the UI can show each
  // tool call as it happens — including the ones that fail and get retried —
  // instead of a spinner until the whole loop is done. The last line is always
  // `done` or `error`; there is no partial-text streaming.
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: TraceEvent) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))
      try {
        emit(await runToolLoop(messages, tools, emit))
      } catch (err) {
        emit({
          type: 'error',
          error: `No reasoning model on AIR answered (is the ASU VPN up?): ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function runToolLoop(
  messages: ChatMessage[],
  tools: Awaited<ReturnType<typeof getTools>>,
  emit: (ev: TraceEvent) => void,
): Promise<TraceEvent> {
  const collected: ToolEvent[] = []
  let reserved: ToolEvent[] = []
  const toolLog: { name: string; ok: boolean; ms: number }[] = []
  let text = ''
  let usedModel = ''
  let totalMs = 0
  let step = 0

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const { value, model, ms } = await callAir('chat', async (m) => {
      const gptOss = m.startsWith('gpt-oss')
      const res = await airFetch(
        '/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            // gpt-oss spends its budget on hidden reasoning before it writes a word,
            // so it needs both a bigger ceiling and its reasoning dialled down.
            max_tokens: gptOss ? 900 : 400,
            temperature: 0.5,
            ...(gptOss ? { reasoning_effort: 'low' } : {}),
            ...(THINKING_OFF.has(m) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
            messages,
            // On the last permitted round the tools are withheld, which forces the
            // model to stop calling and answer in prose.
            ...(tools.length > 0 && round < MAX_TOOL_ROUNDS ? { tools, tool_choice: 'auto' } : {}),
          }),
        },
        55_000,
      )
      const data = (await res.json()) as {
        choices?: { message?: ChatMessage }[]
      }
      const message = data?.choices?.[0]?.message
      if (!message) throw new Error(`${m} returned no message`)
      return message
    })

    usedModel = model
    totalMs += ms

    const msg = value
    messages.push(msg)

    if (msg.tool_calls && msg.tool_calls.length > 0 && round < MAX_TOOL_ROUNDS) {
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments)
        } catch {
          // Invalid JSON, pass empty args
        }

        const id = `s${++step}`
        emit({
          type: 'tool_start',
          id,
          name: call.function.name,
          label: describeToolCall(call.function.name, args),
          round,
        })

        const started = Date.now()
        const r = await callTool(call.function.name, args)
        const took = Date.now() - started
        toolLog.push({ name: call.function.name, ok: r.ok, ms: took })
        emit({
          type: 'tool_end',
          id,
          ok: r.ok,
          ms: took,
          summary: summariseOutcome(call.function.name, r.ok, r.content),
        })

        if (r.ok) {
          const events = extractEvents(r.content)
          for (const event of events) {
            if (!collected.some((e) => e.id === event.id)) {
              collected.push(event)
            }
          }
          // Track reservations separately to avoid showing unrelated events
          if (call.function.name === 'reserve_spot') {
            reserved = events
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: summariseForModel(r.content, r.ok),
        })
      }
      continue
    } else {
      text = (msg.content ?? '').trim()
      break
    }
  }

  // Normalize whitespace
  text = text.replace(/[  ]/g, ' ')

  if (!text) {
    text = 'I could not get an answer together for that — try asking again.'
  }

  return {
    type: 'done',
    text,
    events: reserved.length > 0 ? reserved : collected.slice(0, 5),
    model: usedModel,
    ms: totalMs,
    tools: toolLog,
  }
}
