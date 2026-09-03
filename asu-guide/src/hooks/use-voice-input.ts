'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error'

const MAX_CLIP_MS = 30_000
/** Hard deadline on the upload+transcribe round trip. */
const TRANSCRIBE_TIMEOUT_MS = 30_000
/** Peak amplitude (0-127 from the analyser) below which the clip is silence. */
const SILENCE_PEAK = 6

/**
 * Tap-to-start / tap-to-stop microphone capture.
 *
 * Records webm/opus via MediaRecorder and posts it to /api/transcribe, which
 * forwards to the ASU AIR gateway. Resolves with the transcript.
 */
export function useVoiceInput({
  onTranscript,
  onTranscribeStart,
}: {
  onTranscript: (text: string) => void
  /** Fires the moment recording stops and upload begins — before any network wait. */
  onTranscribeStart?: () => void
}) {
  const [state, setState] = useState<VoiceState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Loudest sample seen while recording, so silence never reaches the gateway. */
  const peakRef = useRef(0)
  /** Whether the analyser produced any samples — rAF is throttled to 0 Hz in a
   *  background tab, and skipped entirely if the AudioContext failed to start. */
  const sampledRef = useRef(false)

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (capRef.current) clearTimeout(capRef.current)
    capRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setLevel(0)
  }, [])

  useEffect(() => teardown, [teardown])

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError('This browser cannot record audio.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Cheap input-level meter so the mic button can pulse while recording.
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const bins = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(bins)
        let peak = 0
        for (const b of bins) peak = Math.max(peak, Math.abs(b - 128))
        sampledRef.current = true
        if (peak > peakRef.current) peakRef.current = peak
        setLevel(Math.min(1, peak / 48))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []

      peakRef.current = 0
      sampledRef.current = false
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        teardown()
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        // Only a measured silence counts as silence. If the meter never ran,
        // send the clip and let the server decide.
        if (sampledRef.current && peakRef.current < SILENCE_PEAK) {
          setState('error')
          setError("I didn't hear anything — check your mic and try again.")
          return
        }
        if (blob.size < 1200) {
          // Too short to contain anything — usually a mis-tap.
          setState('error')
          setError('That was too short to hear. Hold the mic a moment longer.')
          return
        }

        setState('transcribing')
        onTranscribeStart?.()
        try {
          const body = new FormData()
          body.append('audio', blob, 'clip.webm')

          // Without a deadline a stalled request leaves the UI spinning
          // forever: the promise never settles, so nothing can reset the state.
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body,
            signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
          })
          const data = (await res.json()) as { text?: string; error?: string }
          if (!res.ok) throw new Error(data.error ?? `Transcription failed (${res.status})`)

          const text = (data.text ?? '').trim()
          if (text) {
            setState('idle')
            onTranscript(text)
          } else {
            // Silence, or the model heard nothing it was willing to commit to.
            setState('error')
            setError("I didn't catch that — try again a little closer to the mic.")
          }
        } catch (err) {
          setState('error')
          const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
          setError(
            timedOut
              ? 'Transcription timed out. Check the ASU VPN and try again.'
              : err instanceof Error
                ? err.message
                : 'Transcription failed.',
          )
        }
      }

      recorder.start()
      setState('recording')
      capRef.current = setTimeout(stop, MAX_CLIP_MS)
    } catch {
      teardown()
      setState('error')
      setError('Microphone permission denied.')
    }
  }, [onTranscript, onTranscribeStart, stop, teardown])

  const toggle = useCallback(() => {
    if (state === 'recording') stop()
    else if (state !== 'transcribing') void start()
  }, [state, start, stop])

  return { state, error, level, toggle, stop }
}
