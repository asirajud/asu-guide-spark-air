import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { featureGate } from '@/lib/features'
import { safeError } from '@/lib/api-error'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'
import { getNotebook } from '@/lib/notebooks'
import { notebookChatSystemPrompt } from '@/lib/notebook-prompts'

export const runtime = 'nodejs'
export const maxDuration = 60
const MAX_TURNS = 16

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
  const messages = [{ role: 'system', content: system }, ...incoming.slice(-MAX_TURNS)]

  try {
    const { value, model, ms } = await callAir('chat', async (m) => {
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
    return NextResponse.json({
      text: value.replace(/[  ]/g, ' '),
      model,
      ms,
      pages: found.pages.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: safeError('notebooks/chat', err, 'No reasoning model on AIR answered. Try again.') },
      { status: 502 },
    )
  }
}
