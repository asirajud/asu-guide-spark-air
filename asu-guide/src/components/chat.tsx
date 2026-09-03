'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AttachSheet } from '@/components/attach-sheet'
import { Composer } from '@/components/composer'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { downscaleImage } from '@/lib/image'
import { EventCard } from '@/components/event-card'
import { Sparkle } from '@/components/icons'
import type { DemoEvent } from '@/lib/events'

/**
 * Scripted demo. There is no model in the loop — whatever the user types, the
 * assistant replies with this line and the server-rendered event shortlist.
 */
const scriptedReply = (who: string) =>
  `Hey ${who} — there are some events coming up I think you'd be into. I can register you for any of them.`

const THINKING_MS = 600
const WORD_MS = 18

const SUGGESTIONS = [
  "What's happening this week?",
  'Find me a coding club',
  'Something social tonight',
  'Free food on campus',
]

type Phase = 'idle' | 'transcribing' | 'thinking' | 'streaming' | 'done'

export function Chat({
  events,
  asurite,
  onExchange,
  restored,
}: {
  events: DemoEvent[]
  asurite?: string | null
  onExchange?: (ex: {
    prompt: string
    reply: string
    kind: 'events' | 'vision'
    imageName?: string | null
  }) => void
  restored?: { prompt: string; reply: string; kind: 'events' | 'vision' } | null
}) {
  const [phase, setPhase] = useState<Phase>(restored ? 'done' : 'idle')
  const [draft, setDraft] = useState('')
  const [prompt, setPrompt] = useState(restored?.prompt ?? '')
  const [streamed, setStreamed] = useState(restored?.reply ?? '')
  const [replyKind, setReplyKind] = useState<'events' | 'vision'>(restored?.kind ?? 'events')
  const [attachment, setAttachment] = useState<{ file: File; url: string; kind: 'image' | 'video' } | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [visionMeta, setVisionMeta] = useState<{ model: string; ms: number; note?: string } | null>(
    null,
  )
  const [sentImage, setSentImage] = useState<{ url: string; kind: 'image' | 'video' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  function send(text: string) {
    const q = text.trim()
    if (!q || phase === 'thinking' || phase === 'streaming') return

    setPrompt(q)
    setDraft('')
    setStreamed('')
    setPhase('thinking')

    timers.current.push(
      setTimeout(() => {
        setPhase('streaming')
        const reply = scriptedReply(asurite ?? 'there')
        const words = reply.split(' ')
        words.forEach((_, i) => {
          timers.current.push(
            setTimeout(() => {
              setStreamed(words.slice(0, i + 1).join(' '))
              if (i === words.length - 1) {
                setPhase('done')
                onExchange?.({ prompt: q, reply, kind: 'events' })
              }
            }, i * WORD_MS),
          )
        })
      }, THINKING_MS),
    )
  }

  // Voice input: records webm/opus, posts to /api/transcribe -> ASU AIR ASR,
  // drops the transcript into the composer, then auto-sends after a short beat.
  const voice = useVoiceInput({
    // Recording stopped: leave the empty state immediately so the spinner lives
    // in the thread, not in the composer.
    onTranscribeStart: useCallback(() => {
      setSentImage(null)
      setReplyKind('events')
      setPrompt('')
      setStreamed('')
      setPhase('transcribing')
      scrollRef.current?.scrollTo({ top: 0 })
    }, []),
    onTranscript: (text) => {
      // The bubble is already on screen showing a spinner — fill it, let the
      // words land for a beat, then run the reply.
      setPrompt(text)
      setDraft('')
      timers.current.push(setTimeout(() => send(text), 450))
    },
  })

  /** Reveal an already-complete string word by word, same cadence as the script. */
  function streamOut(full: string, onDone?: () => void) {
    setPhase('streaming')
    const words = full.split(' ')
    words.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          setStreamed(words.slice(0, i + 1).join(' '))
          if (i === words.length - 1) {
            setPhase('done')
            onDone?.()
          }
        }, i * WORD_MS),
      )
    })
  }

  /**
   * Image path — this one is NOT scripted. The picture goes to /api/vision,
   * which asks gemma4-31b-it on ASU AIR to describe it, and we stream the real
   * answer back.
   */
  async function sendImage(file: File, question: string, previewUrl: string) {
    setSentImage({ url: previewUrl, kind: 'image' })
    setPrompt(question || 'What is this?')
    setDraft('')
    setStreamed('')
    setVisionMeta(null)
    setReplyKind('vision')
    setPhase('thinking')

    try {
      const body = new FormData()
      body.append('image', await downscaleImage(file))
      if (question) body.append('prompt', question)

      const res = await fetch('/api/vision', { method: 'POST', body })
      const data = (await res.json()) as { text?: string; error?: string; model?: string; ms?: number }
      if (!res.ok || !data.text) throw new Error(data.error ?? 'Could not read that image.')

      setVisionMeta({ model: data.model ?? 'AIR', ms: data.ms ?? 0 })
      const answer = data.text
      streamOut(answer, () =>
        onExchange?.({
          prompt: question || 'What is this?',
          reply: answer,
          kind: 'vision',
          imageName: file.name,
        }),
      )
    } catch (err) {
      setVisionMeta(null)
      streamOut(err instanceof Error ? err.message : 'Something went wrong reading that image.')
    }
  }

  /**
   * Video path — ffmpeg splits the clip, a vision model watches it and an ASR
   * model listens, then a third model fuses the two. All on AIR.
   */
  async function sendVideo(file: File, question: string, previewUrl: string) {
    setSentImage({ url: previewUrl, kind: 'video' })
    setPrompt(question || 'What happens in this video?')
    setDraft('')
    setStreamed('')
    setVisionMeta(null)
    setReplyKind('vision')
    setPhase('thinking')

    try {
      const body = new FormData()
      body.append('video', file)
      if (question) body.append('prompt', question)

      const res = await fetch('/api/video', { method: 'POST', body })
      const data = (await res.json()) as {
        text?: string
        error?: string
        ms?: number
        speechSkipped?: string | null
        models?: { video: string | null; asr: string | null; summarize: string | null }
      }
      if (!res.ok || !data.text) throw new Error(data.error ?? 'Could not read that video.')

      const used = [data.models?.video, data.models?.asr, data.models?.summarize].filter(Boolean)
      setVisionMeta({
        model: used.join(' + ') || 'AIR',
        ms: data.ms ?? 0,
        note: data.speechSkipped ?? undefined,
      })

      const answer = data.text
      streamOut(answer, () =>
        onExchange?.({
          prompt: question || 'What happens in this video?',
          reply: answer,
          kind: 'vision',
          imageName: file.name,
        }),
      )
    } catch (err) {
      setVisionMeta(null)
      streamOut(err instanceof Error ? err.message : 'Something went wrong reading that video.')
    }
  }

  function submit() {
    if (attachment) {
      const { file, url, kind } = attachment
      setAttachment(null)
      if (kind === 'video') void sendVideo(file, draft.trim(), url)
      else void sendImage(file, draft.trim(), url)
      return
    }
    setSentImage(null)
    setReplyKind('events')
    send(draft)
  }

  function pickFile(source: 'files' | 'photos' | 'camera') {
    setAttachOpen(false)
    if (fileRef.current) {
      fileRef.current.capture = source === 'camera' ? 'environment' : ''
      fileRef.current.click()
    }
  }


  // A fresh answer starts at the top of the thread, like the app does.
  useEffect(() => {
    if (phase === 'thinking' || phase === 'transcribing') scrollRef.current?.scrollTo({ top: 0 })
  }, [phase])

  // A failed transcription should not leave an empty bubble hanging.
  if (voice.state === 'error' && phase === 'transcribing' && !prompt) {
    setPhase('idle')
  }

  const isEmpty = phase === 'idle'

  return (
    <>
      {/* Ambient blue glow behind the composer */}
      <div
        aria-hidden
        className={`ambient-glow pointer-events-none absolute inset-x-0 bottom-0 h-[62%] transition-opacity duration-700 ${
          isEmpty ? '' : 'ambient-glow--dim'
        }`}
      />

      <div ref={scrollRef} className="thin-scroll relative z-10 flex-1 overflow-y-auto px-5 pb-8">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center pb-24">
            <Sparkle className="size-[52px]" />
            <h1 className="text-fg mt-5 max-w-[19ch] text-center text-[clamp(26px,7.6vw,32px)] leading-[1.18] font-normal tracking-[-0.03em]">
              {asurite ? 'Where should we start?' : 'Meet ASU Guide, your personal campus assistant'}
            </h1>
          </div>
        ) : (
          <div className="pt-2">
            {/* User bubble */}
            <div className="flex flex-col items-end gap-2">
              {sentImage &&
                (sentImage.kind === 'video' ? (
                  <video
                    src={sentImage.url}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="animate-rise max-h-56 max-w-[70%] rounded-3xl object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sentImage.url}
                    alt="Image you sent"
                    className="animate-rise max-h-56 max-w-[70%] rounded-3xl object-cover"
                  />
                ))}
              <p className="bg-surface-2 text-fg animate-rise max-w-[85%] rounded-3xl px-5 py-3.5 text-[17px] leading-[1.4] tracking-[-0.01em]">
                {phase === 'transcribing' && !prompt ? (
                  <span
                    role="status"
                    aria-label="Transcribing"
                    className="border-muted/40 border-t-fg/80 my-[3px] block size-[17px] animate-spin rounded-full border-2"
                  />
                ) : (
                  prompt
                )}
              </p>
            </div>

            {/* Assistant output — plain text on black, no bubble */}
            <div className="mt-7">
              {phase === 'transcribing' ? null : phase === 'thinking' ? (
                <p className="shimmer-text text-[17px] font-medium">Thinking…</p>
              ) : (
                <>
                  <p className="text-fg text-[17px] leading-[1.55] tracking-[-0.01em]">
                    {streamed}
                    {phase === 'streaming' && (
                      <span className="bg-fg/80 ml-0.5 inline-block h-[17px] w-[2px] translate-y-[2px] animate-pulse" />
                    )}
                  </p>

                  {phase === 'done' && replyKind === 'vision' && visionMeta && (
                    <p className="animate-rise text-muted mt-4 text-[12.5px]">
                      Read by <span className="text-fg/80">{visionMeta.model}</span> on ASU AIR in{' '}
                      {(visionMeta.ms / 1000).toFixed(1)}s
                      {visionMeta.note ? ` · ${visionMeta.note}` : ''}
                    </p>
                  )}

                  {phase === 'done' && replyKind === 'events' && (
                    <>
                      <h2 className="animate-rise mt-6 text-[17px] font-bold text-white">
                        Coming up near you
                      </h2>

                      <ul className="mt-3 flex flex-col gap-3">
                        {events.map((e, i) => (
                          <EventCard key={e.id} event={e} index={i} />
                        ))}
                      </ul>

                      <p
                        className="animate-rise mt-6 text-[12.5px] leading-[1.4] text-[#7c8085]"
                        style={{ animationDelay: '620ms' }}
                      >
                        Getting to know your interests — 3 events attended
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 shrink-0 px-4 pb-5">
        {isEmpty && (
          <div className="no-scroll -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSentImage(null)
                  setReplyKind('events')
                  send(s)
                }}
                className="text-fg shrink-0 rounded-full border border-[#3c4043] px-4 py-2 text-[13.5px] whitespace-nowrap transition-colors hover:bg-[#1f1f1f] active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          inputRef={inputRef}
          voiceState={voice.state}
          voiceLevel={voice.level}
          onMicToggle={voice.toggle}
          onAttachClick={() => setAttachOpen((v) => !v)}
          attachOpen={attachOpen}
          attachment={
            attachment
              ? { url: attachment.url, name: attachment.file.name, kind: attachment.kind }
              : null
          }
          onClearAttachment={() => {
            if (attachment) URL.revokeObjectURL(attachment.url)
            setAttachment(null)
          }}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            if (attachment) URL.revokeObjectURL(attachment.url)
            const kind = file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name)
              ? ('video' as const)
              : ('image' as const)
            setAttachment({ file, url: URL.createObjectURL(file), kind })
            inputRef.current?.focus()
          }}
        />

        <AttachSheet open={attachOpen} onClose={() => setAttachOpen(false)} onPick={pickFile} />

        {voice.error && (
          <p role="alert" className="mt-2 px-2 text-center text-[12.5px] text-red-400/90">
            {voice.error}
          </p>
        )}
      </div>
    </>
  )
}
