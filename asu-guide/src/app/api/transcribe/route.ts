import { NextResponse } from 'next/server'
import { airFetch, callAir } from '@/lib/air/call'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Forwards browser-recorded audio to the ASU AIR gateway for transcription.
 *
 * MediaRecorder produces webm/opus, which the gateway accepts natively — no
 * transcode needed. Falls back down the ASR list if a model is unavailable.
 */
export async function POST(req: Request) {
  let incoming: FormData
  try {
    incoming = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
  }

  const audio = incoming.get('audio')
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: 'No audio supplied.' }, { status: 400 })
  }

  try {
    const { value, model, ms } = await callAir('asr', async (m) => {
      const outgoing = new FormData()
      outgoing.append('file', audio, audio.name || 'clip.webm')
      outgoing.append('model', m)

      const res = await airFetch('/audio/transcriptions', { method: 'POST', body: outgoing }, 45_000)
      const data = (await res.json()) as { text?: string }
      const text = (data.text ?? '').trim()
      if (!text) throw new Error(`${m} returned an empty transcript`)
      return text
    })

    return NextResponse.json({ text: value, model, ms })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Could not transcribe that (is the ASU VPN up?): ${message}` },
      { status: 502 },
    )
  }
}
