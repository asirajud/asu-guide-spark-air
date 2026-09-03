import { NextResponse } from 'next/server'
import { safeError } from '@/lib/api-error'
import { airFetch, callAir } from '@/lib/air/call'

export const runtime = 'nodejs'
export const maxDuration = 60

/** ~30s of opus is well under a megabyte; anything larger is not a voice note. */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const ALLOWED_PREFIX = 'audio/'

/**
 * Single tokens ASR models emit when handed silence or noise. Whisper says
 * "you"; qwen3-asr has produced a bare Chinese filler particle. Treating these
 * as real speech puts words in the user's mouth.
 */
const HALLUCINATIONS = new Set(['you', 'thank you', 'thanks for watching', '嗯', 'um', 'uh', 'bye'])

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
  // vision and video validate their uploads; this route did not. Be lenient
  // about the declared type — curl and some clients send octet-stream — but
  // still refuse anything that is plainly not a media file.
  const looksLikeMedia =
    !audio.type ||
    audio.type === 'application/octet-stream' ||
    audio.type.startsWith(ALLOWED_PREFIX) ||
    audio.type.startsWith('video/') ||
    /\.(webm|wav|mp3|m4a|mp4|ogg|aiff?|flac|mov)$/i.test(audio.name ?? '')

  if (!looksLikeMedia) {
    return NextResponse.json({ error: 'That file is not audio.' }, { status: 415 })
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio is larger than 8MB.' }, { status: 413 })
  }

  try {
    const { value, model, ms } = await callAir('asr', async (m) => {
      const outgoing = new FormData()
      outgoing.append('file', audio, audio.name || 'clip.webm')
      outgoing.append('model', m)

      const res = await airFetch(
        '/audio/transcriptions',
        { method: 'POST', body: outgoing },
        45_000,
      )
      const data = (await res.json()) as { text?: string }
      return (data.text ?? '').trim()
    })

    // An empty transcript is a legitimate answer — the clip was silent. It must
    // NOT be treated as a failed attempt: escalating to the next ASR model just
    // gets a confident hallucination out of it (whisper answers silence with
    // "you"). Report no-speech honestly instead.
    const text = HALLUCINATIONS.has(value.toLowerCase().replace(/[.!?]$/, '')) ? '' : value

    return NextResponse.json({ text, model, ms, noSpeech: text.length === 0 })
  } catch (err) {
    const message = safeError('transcribe', err, 'Could not transcribe that. Try again.')
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
