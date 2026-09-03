import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'
import { prepareVideo } from '@/lib/air/video'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_UPLOAD = 60 * 1024 * 1024
// Same body ceiling as images: the gateway 413s around 3MB of base64.
const MAX_ENCODED = 2_400_000

const VISION_PROMPT =
  'Describe what happens in this video, step by step. Read out any text visible on screen. If it shows an event flyer, poster, or sign, extract the event name, date, time and location.'

/**
 * Video → text. The visual and speech tracks are analysed in parallel by two
 * different AIR models, then fused by a third.
 *
 * The audio leg is skipped entirely when the track is silent: ASR models invent
 * plausible text from noise, so "no speech" has to be detected before the call,
 * not explained away after it.
 */
export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
  }

  const upload = form.get('video')
  const question = (form.get('prompt') as string | null)?.trim()

  if (!(upload instanceof File) || upload.size === 0) {
    return NextResponse.json({ error: 'No video supplied.' }, { status: 400 })
  }
  if (!upload.type.startsWith('video/') && !upload.name.match(/\.(mp4|mov|m4v|webm)$/i)) {
    return NextResponse.json({ error: 'That file is not a video.' }, { status: 415 })
  }
  if (upload.size > MAX_UPLOAD) {
    return NextResponse.json({ error: 'Video is larger than 60MB.' }, { status: 413 })
  }

  const started = Date.now()
  let prepared

  try {
    prepared = await prepareVideo(upload)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not process that video.' },
      { status: 422 },
    )
  }

  try {
    const videoBytes = await readFile(prepared.videoPath)
    if (videoBytes.byteLength * 1.34 > MAX_ENCODED) {
      return NextResponse.json(
        {
          error:
            'That clip is still too large after downscaling. Try a shorter one (under ~10 seconds).',
        },
        { status: 413 },
      )
    }
    const dataUrl = `data:video/mp4;base64,${videoBytes.toString('base64')}`

    // Both legs at once — wall clock is the vision call, not the sum.
    const [visionResult, speechResult] = await Promise.allSettled([
      callAir('video', async (m) => {
        const res = await airFetch(
          '/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: m,
              max_tokens: 380,
              temperature: 0.2,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: question || VISION_PROMPT },
                    { type: 'video_url', video_url: { url: dataUrl } },
                  ],
                },
              ],
            }),
          },
          110_000,
        )
        const data = await res.json()
        const text: string = data?.choices?.[0]?.message?.content?.trim() ?? ''
        if (!text) throw new Error(`${m} returned no description`)
        return text
      }),

      prepared.audioPath
        ? callAir('asr', async (m) => {
            const wav = await readFile(prepared.audioPath as string)
            const body = new FormData()
            body.append('file', new File([new Uint8Array(wav)], 'audio.wav', { type: 'audio/wav' }), 'audio.wav')
            body.append('model', m)
            const res = await airFetch('/audio/transcriptions', { method: 'POST', body }, 60_000)
            const data = (await res.json()) as { text?: string }
            return (data.text ?? '').trim()
          })
        : Promise.reject(new Error(prepared.silenceReason ?? 'No audio.')),
    ])

    const visual = visionResult.status === 'fulfilled' ? visionResult.value.value : null
    const transcript = speechResult.status === 'fulfilled' ? speechResult.value.value : null

    if (!visual && !transcript) {
      return NextResponse.json(
        { error: 'Neither the picture nor the sound could be read.' },
        { status: 502 },
      )
    }

    // Fuse the two views. The summariser is told where each part came from so it
    // can say "nothing was said" instead of inventing narration.
    let summary = visual ?? transcript ?? ''
    let summaryModel: string | null = null

    if (visual && transcript) {
      try {
        const fused = await callAir('summarize', async (m) => {
          const res = await airFetch(
            '/chat/completions',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: m,
                max_tokens: 300,
                temperature: 0.3,
                ...(THINKING_OFF.has(m) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
                messages: [
                  {
                    role: 'system',
                    content:
                      'You merge two machine-generated views of the same video into one short answer: what a vision model saw, and what a speech model heard. Write 2–4 sentences. Use only what you are given — never invent detail. If the two disagree, say so plainly.',
                  },
                  {
                    role: 'user',
                    content: `What the vision model saw:\n${visual}\n\nWhat was said (speech-to-text):\n"${transcript}"\n\n${
                      question ? `The person asked: ${question}\n\n` : ''
                    }Give one combined answer.`,
                  },
                ],
              }),
            },
            30_000,
          )
          const data = await res.json()
          const text: string = data?.choices?.[0]?.message?.content?.trim() ?? ''
          if (!text) throw new Error(`${m} returned an empty summary`)
          return text
        })
        summary = fused.value
        summaryModel = fused.model
      } catch {
        // Fusion is a nicety; the visual description alone is still useful.
        summary = visual
      }
    }

    return NextResponse.json({
      text: summary,
      visual,
      transcript,
      speechSkipped: prepared.silenceReason,
      meanVolumeDb: prepared.meanVolumeDb,
      durationSeconds: Number(prepared.durationSeconds.toFixed(1)),
      models: {
        video: visionResult.status === 'fulfilled' ? visionResult.value.model : null,
        asr: speechResult.status === 'fulfilled' ? speechResult.value.model : null,
        summarize: summaryModel,
      },
      ms: Date.now() - started,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Could not read that video: ${message}` }, { status: 502 })
  } finally {
    await prepared.cleanup()
  }
}
