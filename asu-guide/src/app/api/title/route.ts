import { NextResponse } from 'next/server'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'

export const runtime = 'nodejs'
export const maxDuration = 30

function fallbackTitle(prompt: string) {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  return clean.length > 42 ? `${clean.slice(0, 42).trimEnd()}…` : clean || 'New chat'
}

/** Names a conversation from its opening message, using an ASU AIR model. */
export async function POST(req: Request) {
  const { prompt } = (await req.json()) as { prompt?: string }
  const opener = (prompt ?? '').trim()
  if (!opener) return NextResponse.json({ title: 'New chat', model: null })

  try {
    const { value, model, ms } = await callAir('title', async (m) => {
      const res = await airFetch(
        '/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            max_tokens: 24,
            temperature: 0.3,
            ...(THINKING_OFF.has(m) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
            messages: [
              {
                role: 'system',
                content:
                  'You name chat conversations. Reply with a title of 3 to 6 words in Title Case. No quotes, no punctuation at the end, no preamble.',
              },
              { role: 'user', content: `Title this conversation:\n\n${opener.slice(0, 500)}` },
            ],
          }),
        },
        12_000,
      )

      const data = await res.json()
      const title = (data?.choices?.[0]?.message?.content ?? '')
        .replace(/^["'\s]+|["'\s.]+$/g, '')
        .split('\n')[0]
        .slice(0, 60)
        .trim()

      // An empty completion is a broken model for this job (inkling-small does
      // this), but not a gateway rejection — so fail this attempt and move on.
      if (!title) throw new Error(`${m} returned an empty title`)
      return title
    })

    return NextResponse.json({ title: value, model, ms })
  } catch {
    // Every model refused or failed — still name the chat, just locally.
    return NextResponse.json({ title: fallbackTitle(opener), model: null })
  }
}
