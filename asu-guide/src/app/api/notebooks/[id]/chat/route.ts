import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { featureGate } from '@/lib/features'
import { safeError } from '@/lib/api-error'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'
import { getNotebook } from '@/lib/notebooks'
import { notebookChatSystemPrompt } from '@/lib/notebook-prompts'
import { callTool, getTools, summariseForModel } from '@/lib/tools'

export const runtime = 'nodejs'
export const maxDuration = 60
const MAX_TURNS = 16
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * Appended to the notebook prompt only when web_search is actually available.
 *
 * Routing is deterministic, not left to native tool calling: with a 24K-char
 * system prompt qwen35-27b reliably declined to call web_search and instead
 * wrote "From the web:" from memory. So the model is asked for a one-line
 * SEARCH request instead; the code runs the search and asks again with results.
 */
const WEB_FALLBACK = `
One more rule. When the pages do NOT contain what is asked (a name, a date, a definition, background the student never wrote down), do not answer from memory. Instead reply with exactly one line and nothing else:
SEARCH: <a short web search query for the missing part>
You will then be given web results and asked again. When the pages do cover the question, answer normally and never emit a SEARCH line.`

// Multiline: the model tends to put a sentence about the notebook before the line.
const SEARCH_LINE = /^\s*SEARCH:\s*(.+?)\s*$/im

function withResults(query: string, results: string): string {
  return `Web results for "${query}":\n${results}\n\nNow answer the student's last question. Say first what the notebook does say about it, with page numbers, or that it does not cover it. Then write "From the web:" and what the results show, naming the source. Never present web results as if they were in the notebook. Do not emit a SEARCH line.`
}

async function complete(messages: ChatMessage[]) {
  return callAir('chat', async (m) => {
    const gptOss = m.startsWith('gpt-oss')
    const res = await airFetch(
      '/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          max_tokens: gptOss ? 1000 : 500,
          temperature: 0.4,
          ...(gptOss ? { reasoning_effort: 'low' } : {}),
          ...(THINKING_OFF.has(m) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          messages,
        }),
      },
      55_000,
    )
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
    const text = (data.choices?.[0]?.message?.content ?? '').trim()
    if (!text) throw new Error(`${m} returned no answer`)
    return text
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = featureGate('notebooks')
  if (gate) return gate
  const { id } = await params
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Sign in to ask about a notebook.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  // Only user and assistant turns are accepted. Passing role through verbatim
  // would let a client post role:"system" and prepend its own instructions
  // ahead of the tool policy.
  const incoming = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m: unknown): m is { role: 'user' | 'assistant'; content: string } => {
      if (!m || typeof m !== 'object') return false
      const t = m as { role?: unknown; content?: unknown }
      return (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string'
    },
  )
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No messages supplied.' }, { status: 400 })
  }

  const found = await getNotebook(id, session.asurite)
  if (!found) {
    return NextResponse.json({ error: 'No such notebook.' }, { status: 404 })
  }

  const firstName = session.name?.trim().split(/\s+/)[0] || null

  const system = notebookChatSystemPrompt(
    found.notebook.name,
    found.notebook.digest,
    found.pages.map((p) => ({ position: p.position, reading: p.reading, status: p.status })),
    firstName,
  )
  // Only web_search reaches into a notebook; event search and RSVP belong to the
  // main chat. If the search service is off (no key), the model simply has no fallback.
  const canSearch = (await getTools()).some((t) => t.function.name === 'web_search')
  const messages: ChatMessage[] = [
    { role: 'system', content: canSearch ? system + WEB_FALLBACK : system },
    ...incoming.slice(-MAX_TURNS),
  ]

  try {
    let searched = false
    let { value: text, model, ms } = await complete(messages)

    const wanted = canSearch ? SEARCH_LINE.exec(text) : null
    if (wanted) {
      const query = wanted[1].slice(0, 200)
      const r = await callTool('web_search', { query, count: 5 })
      searched = r.ok
      const second = await complete([
        ...messages,
        { role: 'assistant', content: text },
        {
          role: 'user',
          content: withResults(
            query,
            r.ok
              ? summariseForModel(r.content, true)
              : 'The web search failed; answer from the notebook only and say the rest could not be looked up.',
          ),
        },
      ])
      text = second.value.replace(SEARCH_LINE, '').trim() || second.value
      model = second.model
      ms += second.ms
    } else if (SEARCH_LINE.test(text)) {
      text = 'The notebook does not cover that, and web search is not available right now.'
    }

    return NextResponse.json({
      text: text.replace(/[  ]/g, ' '),
      model,
      ms,
      pages: found.pages.length,
      searched,
    })
  } catch (err) {
    return NextResponse.json(
      { error: safeError('notebooks/chat', err, 'No reasoning model on AIR answered. Try again.') },
      { status: 502 },
    )
  }
}
