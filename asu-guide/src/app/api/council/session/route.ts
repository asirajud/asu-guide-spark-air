import { NextResponse } from 'next/server'
import { callAir, airFetch } from '@/lib/air/call'
import { getCouncilModelChain, THINKING_OFF } from '@/lib/air/models'
import { PANEL_DEFINITIONS } from '@/lib/council/panels'

export const runtime = 'nodejs'
export const maxDuration = 120

type CouncilSessionRequest = {
  concept: string
  course: string
  panel: 'study' | 'rubric'
  explain_language: string
  quiz_language: string
}

type CouncilEvent =
  | {
      type: 'session_start'
      concept: string
      course: string
      panel: 'study' | 'rubric'
      explain_language: string
      quiz_language: string
      roster: string[]
    }
  | { type: 'panelist'; index: number; role_name: string; text: string; model: string; ms: number }
  | { type: 'panelist_failed'; index: number; role_name: string; error: string }
  | { type: 'moderator'; text: string; model: string; ms: number }
  | { type: 'moderator_failed'; error: string }
  | { type: 'done'; model_map: Record<string, string | null>; total_ms: number }
  | { type: 'error'; error: string }

async function attempt(
  model: string,
  maxTokens: number,
  temperature: number,
  systemPrompt: string,
  userMessage: string,
  timeout: number,
) {
  const gptOss = model.startsWith('gpt-oss')
  const res = await airFetch(
    '/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: gptOss ? 900 : maxTokens,
        temperature,
        ...(gptOss ? { reasoning_effort: 'low' } : {}),
        ...(THINKING_OFF.has(model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    },
    timeout,
  )

  const data = await res.json()

  // Safely extract content from the response
  const choices = data.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error(`${model} returned no choices`)
  }

  const message = choices[0].message
  if (!message || typeof message.content !== 'string') {
    throw new Error(`${model} returned no content`)
  }

  return message.content.trim()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const { concept, course, panel, explain_language, quiz_language } =
    body as Partial<CouncilSessionRequest>

  // Validate request
  if (typeof concept !== 'string' || concept.length > 500) {
    return NextResponse.json({ error: 'concept must be ≤500 chars' }, { status: 400 })
  }

  if (typeof course !== 'string' || course.length > 100) {
    return NextResponse.json({ error: 'course must be ≤100 chars' }, { status: 400 })
  }

  if (panel !== 'study' && panel !== 'rubric') {
    return NextResponse.json({ error: "panel must be 'study' or 'rubric'" }, { status: 400 })
  }

  if (typeof explain_language !== 'string' || explain_language.length > 64) {
    return NextResponse.json({ error: 'explain_language must be ≤64 chars' }, { status: 400 })
  }

  if (typeof quiz_language !== 'string' || quiz_language.length > 64) {
    return NextResponse.json({ error: 'quiz_language must be ≤64 chars' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now()
      const emit = (ev: CouncilEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))

      try {
        const definition = PANEL_DEFINITIONS[panel]
        const roster = [
          ...definition.panelists.map((p) => p.role_name),
          definition.moderator.role_name,
        ]

        // Emit session_start event
        emit({
          type: 'session_start',
          concept,
          course,
          panel,
          explain_language,
          quiz_language,
          roster,
        })

        // Build panelist promises with parallel execution
        const panelistPromises: Array<
          Promise<{
            success: boolean
            index: number
            role_name: string
            text?: string
            model?: string
            ms?: number
            error?: string
          }>
        > = []

        for (let i = 0; i < definition.panelists.length; i++) {
          const role = definition.panelists[i]
          // study panelists answer in explain_language; rubric panelists answer in quiz_language (their output is assessment/quiz content); the moderator answers in explain_language
          const language = panel === 'rubric' ? quiz_language : explain_language
          const promise = callAir(
            'council',
            (m) =>
              attempt(
                m,
                600,
                0.7,
                `${role.system_prompt}\n\nAnswer in ${language}.`,
                `Concept: ${concept}\nCourse: ${course}`,
                55_000,
              ),
            getCouncilModelChain(role),
          )
            .then((result) => {
              emit({
                type: 'panelist',
                index: i,
                role_name: role.role_name,
                text: result.value,
                model: result.model,
                ms: result.ms,
              })
              return {
                success: true,
                index: i,
                role_name: role.role_name,
                text: result.value,
                model: result.model,
                ms: result.ms,
              }
            })
            .catch((error) => {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              emit({
                type: 'panelist_failed',
                index: i,
                role_name: role.role_name,
                error: errorMessage,
              })
              return {
                success: false,
                index: i,
                role_name: role.role_name,
                error: errorMessage,
              }
            })

          panelistPromises.push(promise)
        }

        // Wait for all panelist promises to settle
        const panelistResults = await Promise.allSettled(panelistPromises)

        // Flatten results to array of objects
        const panelistResultObjects = panelistResults.map((result) =>
          result.status === 'fulfilled' ? result.value : result.reason,
        )

        // Count successful panelists
        const successfulCount = panelistResultObjects.filter((r) => r.success).length

        // If no panelists succeeded, emit error and return
        if (successfulCount === 0) {
          emit({
            type: 'error',
            error: 'All panelist requests failed. Check ASU VPN connection.',
          })
          return
        }

        // Prepare moderator attempt
        const moderator = definition.moderator
        try {
          // Build system prompt with fixed instructions
          const systemPrompt = `${moderator.system_prompt}\n\nUse only the panelist texts you are given. If a panelist is marked unavailable, say nothing for that perspective — never invent it.\n\nAnswer in ${explain_language}.`

          // Build user message with concept/course and panelist responses
          const panelistTexts = panelistResultObjects
            .map((r) =>
              r.success
                ? `(${r.role_name}): ${r.text}`
                : `(${r.role_name}): [unavailable — could not be produced]`,
            )
            .join('\n')

          const userMessage = `Concept: ${concept}\nCourse: ${course}\n\nPanelist responses:\n${panelistTexts}`

          const result = await callAir(
            'council',
            (m) => attempt(m, 300, 0.3, systemPrompt, userMessage, 45_000),
            getCouncilModelChain(moderator),
          )

          emit({
            type: 'moderator',
            text: result.value,
            model: result.model,
            ms: result.ms,
          })

          // Build model map
          const modelMap: Record<string, string | null> = {}
          panelistResultObjects.forEach((r) => {
            modelMap[r.role_name] = r.success ? (r.model as string) : null
          })
          modelMap[moderator.role_name] = result.model

          // Emit done event with wall clock timing
          emit({
            type: 'done',
            model_map: modelMap,
            total_ms: Date.now() - started,
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          emit({
            type: 'moderator_failed',
            error: errorMessage,
          })

          // Build model map with null moderator
          const modelMap: Record<string, string | null> = {}
          panelistResultObjects.forEach((r) => {
            modelMap[r.role_name] = r.success ? (r.model as string) : null
          })
          modelMap[moderator.role_name] = null

          // Emit done event even on moderator failure
          emit({
            type: 'done',
            model_map: modelMap,
            total_ms: Date.now() - started,
          })
        }
      } catch (error) {
        emit({
          type: 'error',
          error: `No reasoning model on AIR answered (is the ASU VPN up?): ${error instanceof Error ? error.message : 'Unknown error'}`,
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
