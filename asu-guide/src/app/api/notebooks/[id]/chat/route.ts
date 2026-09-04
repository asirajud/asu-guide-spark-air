import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { featureGate } from '@/lib/features'
import { safeError } from '@/lib/api-error'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'
import { getNotebook } from '@/lib/notebooks'
import { notebookChatSystemPrompt } from '@/lib/notebook-prompts'
import { callTool, getTools, summariseForModel } from '@/lib/tools'

type WebHit = { title?: string; url?: string; snippet?: string; source?: string }

/**
 * The registry returns MCP content: `[{ type: 'text', text: '<json>' }]` with the
 * hits inside the string. summariseForModel() JSON-escapes all of that and cuts
 * it at 1200 chars, which left the model one and a half results to work from —
 * hence the one-sentence answers. Unpack and lay the hits out plainly.
 */
function formatWebResults(content: unknown): string | null {
  try {
    const parts = (content as { content?: { type?: string; text?: string }[] })?.content
    const text =
      parts?.find((p) => p.type === 'text')?.text ?? (typeof content === 'string' ? content : null)
    if (!text) return null
    const data = JSON.parse(text) as { results?: WebHit[] }
    const hits = (data.results ?? []).filter((h) => h.title && h.url)
    if (hits.length === 0) return null
    return hits
      .slice(0, 5)
      .map((h, i) => `${i + 1}. ${h.title} — ${h.url}${h.snippet ? `\n   ${h.snippet}` : ''}`)
      .join('\n')
  } catch {
    return null
  }
}

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
One more rule, and it overrides the "never pull in outside knowledge" line above: you CAN reach the web, through me. Two cases call for it. (1) The student explicitly asks you to search, look something up, find other courses, check online, etc. (2) The pages do NOT contain what is asked (a name, a date, a definition, background the student never wrote down). In either case do not answer from memory and never say you cannot search. Reply with exactly one line and nothing else:
SEARCH: <a short web search query>
You will then be given web results and asked again. When the pages do cover the question and the student did not ask for a search, answer normally and never emit a SEARCH line.`

// Multiline: the model tends to put a sentence about the notebook before the line.
const SEARCH_LINE = /^\s*SEARCH:\s*(.+?)\s*$/im

function withResults(query: string, results: string): string {
  return `Web results for "${query}":
${results}

Now answer the student's last question. One short sentence first on what the notebook does say about it, with page numbers, or that it does not cover it. Then a new paragraph starting "From the web:" that actually answers from the results — when the student asked for options or a list, give the relevant results as a short list, each with its title and link and a phrase on what it offers; otherwise two or three sentences naming the source. Use only what the results say. Never present web results as if they were in the notebook. Do not emit a SEARCH line.`
}

async function complete(messages: ChatMessage[], maxTokens = 500) {
  return callAir('chat', async (m) => {
    const gptOss = m.startsWith('gpt-oss')
    const res = await airFetch(
      '/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          max_tokens: gptOss ? maxTokens + 500 : maxTokens,
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
      const second = await complete(
        [
          ...messages,
          { role: 'assistant', content: text },
          {
            role: 'user',
            content: withResults(
              query,
              r.ok
                ? (formatWebResults(r.content) ?? summariseForModel(r.content, true))
                : 'The web search failed; answer from the notebook only and say the rest could not be looked up.',
            ),
          },
        ],
        800,
      )
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
