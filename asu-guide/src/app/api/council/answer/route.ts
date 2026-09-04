import { NextResponse } from 'next/server'
import { callAir, airFetch } from '@/lib/air/call'
import { getCouncilModelChain, THINKING_OFF } from '@/lib/air/models'
import { PANEL_DEFINITIONS } from '@/lib/council/panels'

export const runtime = 'nodejs'
export const maxDuration = 60

type CouncilAnswerRequest = {
  concept: string
  course: string
  panel: 'study' | 'rubric'
  question: string
  answer: string
  explain_language: string
  quiz_language: string
}

async function attempt(
  model: string,
  maxTokens: number,
  temperature: number,
  systemPrompt: string,
  userMessage: string,
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
    45_000,
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

  // Parse the response immediately inside the attempt function
  const lines = message.content.trim().split('\n')
  const firstLine = lines[0].trim()

  // Extract verdict and explanation
  const verdictToken = firstLine.split(/\s+/)[0]
  if (verdictToken !== 'UNDERSTOOD' && verdictToken !== 'NOT_YET') {
    throw new Error('Response must start with exactly "UNDERSTOOD" or "NOT_YET"')
  }

  // Handle lenient same-line explanation: if first line has extra content after verdict, use it
  let explanation = lines.slice(1).join('\n').trim()
  const remainingFirstLine = firstLine.substring(verdictToken.length).trim()
  if (remainingFirstLine) {
    // Remove common prefixes like ": " or ". "
    const cleanedRemaining = remainingFirstLine.replace(/^[:.]?\s*/, '')
    if (cleanedRemaining) {
      explanation = cleanedRemaining + (explanation ? '\n' + explanation : '')
    }
  }

  return {
    verdict: verdictToken,
    explanation,
    value: message.content.trim(),
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const { concept, course, panel, question, answer, explain_language, quiz_language } =
    body as Partial<CouncilAnswerRequest>

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

  if (typeof question !== 'string' || question.length > 200) {
    return NextResponse.json({ error: 'question must be ≤200 chars' }, { status: 400 })
  }

  if (typeof answer !== 'string' || answer.length > 1000) {
    return NextResponse.json({ error: 'answer must be ≤1000 chars' }, { status: 400 })
  }

  if (typeof explain_language !== 'string' || explain_language.length > 64) {
    return NextResponse.json({ error: 'explain_language must be ≤64 chars' }, { status: 400 })
  }

  if (typeof quiz_language !== 'string' || quiz_language.length > 64) {
    return NextResponse.json({ error: 'quiz_language must be ≤64 chars' }, { status: 400 })
  }

  try {
    const definition = PANEL_DEFINITIONS[panel]
    const moderator = definition.moderator

    // Create the evaluation prompt
    const systemPrompt = `${moderator.system_prompt}\n\nJudge the student's answer to the question about the concept. Reply must begin with exactly "UNDERSTOOD" or "NOT_YET", then on the next line a short plain-text explanation in ${explain_language}.`

    const userMessage = `Concept: ${concept}\nCourse: ${course}\nQuestion: ${question}\nStudent Answer: ${answer}`

    const { value, model, ms } = await callAir(
      'council',
      (m) => attempt(m, 250, 0.2, systemPrompt, userMessage),
      getCouncilModelChain(moderator),
    )

    // Return the parsed result directly
    return NextResponse.json({
      verdict: value.verdict,
      explanation: value.explanation,
      model,
      ms,
    })
  } catch {
    return NextResponse.json({ error: 'All models in council chain failed' }, { status: 502 })
  }
}
