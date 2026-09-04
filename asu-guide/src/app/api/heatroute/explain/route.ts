import { NextResponse } from 'next/server'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'
import { safeError } from '@/lib/api-error'
import type { HeatRouteExplainPayload } from '@/lib/heatroute-ai'

export const runtime = 'nodejs'
export const maxDuration = 45

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function isPayload(body: unknown): body is HeatRouteExplainPayload {
  if (!body || typeof body !== 'object') return false
  const value = body as Partial<HeatRouteExplainPayload>
  return (
    typeof value.start === 'string' &&
    typeof value.destination === 'string' &&
    typeof value.departureIso === 'string' &&
    typeof value.departureLabel === 'string' &&
    typeof value.mobilityMode === 'boolean' &&
    typeof value.includeShuttle === 'boolean' &&
    typeof value.selectedRoute === 'object' &&
    value.selectedRoute !== null
  )
}

function systemPrompt() {
  return `You explain HeatRoute ASU recommendations for students.
Use only the supplied structured route data.
Be concise: two or three short sentences.
Mention that exposure is estimated when discussing sun or heat.
Do not give medical, emergency, legal, or turn-by-turn navigation advice.
Do not invent buildings, weather, live shuttle status, or map facts not present in the data.`
}

function userPrompt(payload: HeatRouteExplainPayload) {
  return `Explain the selected HeatRoute option in student-friendly language.

Route data:
${JSON.stringify(payload, null, 2)}`
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!isPayload(body)) {
    return NextResponse.json(
      { error: 'Expected a HeatRoute explanation payload.' },
      { status: 400 },
    )
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userPrompt(body) },
  ]

  try {
    const result = await callAir('summarize', async (model) => {
      const res = await airFetch(
        '/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            max_tokens: 260,
            temperature: 0.35,
            ...(THINKING_OFF.has(model)
              ? { chat_template_kwargs: { enable_thinking: false } }
              : {}),
            messages,
          }),
        },
        42_000,
      )
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null } }[]
      }
      const explanation = data.choices?.[0]?.message?.content?.trim()
      if (!explanation) throw new Error(`${model} returned no HeatRoute explanation.`)
      return explanation.replace(/[ \t]+/g, ' ')
    })

    return NextResponse.json({
      explanation: result.value,
      model: result.model,
      ms: result.ms,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: safeError(
          'heatroute/explain',
          err,
          'Could not generate an AI route explanation right now.',
        ),
      },
      { status: 502 },
    )
  }
}
