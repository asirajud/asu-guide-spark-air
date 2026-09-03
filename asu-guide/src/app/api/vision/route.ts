import { NextResponse } from 'next/server'
import { safeError } from '@/lib/api-error'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024
// The gateway 413s above roughly 3MB of base64 (~2.2MB of bytes). The client
// downscales first; this is the backstop with a message a human can act on.
const AIR_SAFE_BYTES = 2_200_000

const DEFAULT_PROMPT =
  'Describe this image in 2–3 short sentences. If it is a flyer or poster for an event, pull out the event name, date, time and location.'

/** Real (not scripted) image understanding, with model fallback. */
export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
  }

  const image = form.get('image')
  const question = (form.get('prompt') as string | null)?.trim()

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: 'No image supplied.' }, { status: 400 })
  }
  if (!image.type.startsWith('image/')) {
    return NextResponse.json({ error: 'That file is not an image.' }, { status: 415 })
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is larger than 8MB.' }, { status: 413 })
  }
  if (image.size > AIR_SAFE_BYTES) {
    return NextResponse.json(
      { error: 'That image is too large for the AIR gateway. Try a smaller one.' },
      { status: 413 },
    )
  }

  const dataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString('base64')}`

  try {
    const { value, model, ms } = await callAir('vision', async (m) => {
      const res = await airFetch(
        '/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            max_tokens: 320,
            temperature: 0.2,
            ...(THINKING_OFF.has(m) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: question || DEFAULT_PROMPT },
                  { type: 'image_url', image_url: { url: dataUrl } },
                ],
              },
            ],
          }),
        },
        50_000,
      )

      const data = await res.json()
      const text: string = data?.choices?.[0]?.message?.content?.trim() ?? ''
      if (!text) throw new Error(`${m} returned no description`)
      return text
    })

    return NextResponse.json({ text: value, model, ms })
  } catch (err) {
    const message = safeError('vision', err, 'Could not read that image. Try again.')
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
