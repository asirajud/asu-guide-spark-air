'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AttachSheet } from '@/components/attach-sheet'
import { Composer } from '@/components/composer'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { downscaleImage } from '@/lib/image'
import { EventCard } from '@/components/event-card'
import { RichText } from '@/components/rich-text'
import { Sparkle } from '@/components/icons'
import type { DemoEvent } from '@/lib/events'

export type Turn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  kind: 'text' | 'events' | 'vision'
  /** Object URL of an image or video the user attached to this turn. */
  mediaUrl?: string | null
  mediaKind?: 'image' | 'video' | null
  /** Event cards the assistant cited on this turn. */
  events?: DemoEvent[]
  /** "Read by X on ASU AIR in 2.1s" footnote for a media reply. */
  meta?: { model: string; ms: number; note?: string } | null
  /** Rehydrated from SQLite — its cited cards were not stored. */
  restored?: boolean
}

let seq = 0
const uid = () => `t${Date.now().toString(36)}-${seq++}`

type Phase = 'idle' | 'transcribing' | 'thinking' | 'streaming' | 'done'

export function Chat({ events, asurite, onTurn, restoredTurns }: {
  events: DemoEvent[]
  asurite?: string | null
  /** Called once a turn is final, so the shell can persist it. */
  onTurn?: (t: { role: 'user' | 'assistant'; content: string; kind: string; imageName?: string | null }) => void
  restoredTurns?: Turn[] | null
}) {
  const [turns, setTurns] = useState<Turn[]>(restoredTurns ?? [])
  const [phase, setPhase] = useState<Phase>(restoredTurns?.length ? 'done' : 'idle')
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<{ file: File; url: string; kind: 'image' | 'video' } | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  /** Push an assistant turn and reveal it word by word, the app's own cadence. */
  function appendAssistant(
    full: string,
    kind: 'text' | 'events' | 'vision',
    cards: DemoEvent[] = [],
    meta: Turn['meta'] = null,
  ) {
    const body = full.trim() || 'Sorry — I did not get an answer that time.'
    const id = uid()
    setTurns((t) => [...t, { id, role: 'assistant', content: '', kind, events: cards, meta }])
    setPhase('streaming')
    // Split on whitespace but KEEP the separators, so newlines and indentation
    // survive the reveal. Joining tokens with ' ' flattens code blocks.
    const words = body.split(/(\s+)/).filter((w) => w.length > 0)
    words.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          const partial = words.slice(0, i + 1).join('')
          setTurns((t) => t.map((x) => (x.id === id ? { ...x, content: partial } : x)))
    if (i === words.length - 1) {
      setPhase('done')
      onTurn?.({ role: 'assistant', content: body, kind })
    }
        }, i * 18),
      )
    })
  }

  /**
   * One reasoning model on ASU AIR owns the whole conversation. Every prior turn
   * goes back up with each request, including the descriptions the vision and
   * speech models produced, so the model can answer "what time was that again?"
   * three turns after the flyer was uploaded.
   */
  async function send(text: string) {
    const q = text.trim()
    if (!q || phase === 'thinking' || phase === 'streaming') return
    const userTurn: Turn = { id: uid(), role: 'user', content: q, kind: 'text' }
    const next = [...turns, userTurn]
    setTurns(next)
    setDraft('')
    setPhase('thinking')
    onTurn?.({ role: 'user', content: q, kind: 'text' })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content, kind: t.kind })),
          asurite: asurite ?? null,
        }),
      })
      const data = (await res.json()) as { text?: string; events?: DemoEvent[]; error?: string }
      if (!res.ok || !data.text) throw new Error(data.error ?? 'No answer came back.')
      const cards = data.events ?? []
      appendAssistant(data.text, cards.length ? 'events' : 'text', cards)
    } catch (err) {
      appendAssistant(err instanceof Error ? err.message : 'Something went wrong.', 'text')
    }
  }

  // Voice input: records webm/opus, posts to /api/transcribe -> ASU AIR ASR,
  // drops the transcript into the composer, then auto-sends after a short beat.
  const voice = useVoiceInput({
    // Recording stopped: leave the empty state immediately so the spinner lives
    // in the thread, not in the composer.
    onTranscribeStart: useCallback(() => {
      setPhase('transcribing')
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, []),
    onTranscript: (text) => {
      // Hand straight to send(): it adds the user bubble in the same commit that
      // clears the 'transcribing' phase, so the spinner is replaced by the text
      // rather than both vanishing for a beat while the thread collapses.
      setDraft('')
      void send(text)
    },
  })

  /**
   * Image path — this one is NOT scripted. The picture goes to /api/vision,
   * which asks gemma4-31b-it on ASU AIR to describe it, and we stream the real
   * answer back.
   */
  async function sendImage(file: File, question: string, previewUrl: string) {
    const q = question || 'What is this?'
    setTurns((t) => [...t, { id: uid(), role: 'user', content: q, kind: 'vision', mediaUrl: previewUrl, mediaKind: 'image' }])
    setDraft('')
    setPhase('thinking')
    onTurn?.({ role: 'user', content: q, kind: 'vision', imageName: file.name })

    try {
      const body = new FormData()
      body.append('image', await downscaleImage(file))
      if (question) body.append('prompt', question)

      const res = await fetch('/api/vision', { method: 'POST', body })
      const data = (await res.json()) as { text?: string; error?: string; model?: string; ms?: number }
      if (!res.ok || !data.text) throw new Error(data.error ?? 'Could not read that image.')

      appendAssistant(data.text, 'vision', [], { model: data.model ?? 'AIR', ms: data.ms ?? 0 })
    } catch (err) {
      appendAssistant(err instanceof Error ? err.message : 'Something went wrong reading that image.', 'text')
    }
  }

  /**
   * Video path — ffmpeg splits the clip, a vision model watches it and an ASR
   * model listens, then a third model fuses the two. All on AIR.
   */
  async function sendVideo(file: File, question: string, previewUrl: string) {
    const q = question || 'What happens in this video?'
    setTurns((t) => [...t, { id: uid(), role: 'user', content: q, kind: 'vision', mediaUrl: previewUrl, mediaKind: 'video' }])
    setDraft('')
    setPhase('thinking')
    onTurn?.({ role: 'user', content: q, kind: 'vision', imageName: file.name })

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
      const note = data.speechSkipped ?? undefined

      appendAssistant(data.text, 'vision', [], {
        model: used.join(' + ') || 'AIR',
        ms: data.ms ?? 0,
        note,
      })
    } catch (err) {
      appendAssistant(err instanceof Error ? err.message : 'Something went wrong reading that video.', 'text')
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
    void send(draft)
  }

  function pickFile(source: 'files' | 'photos' | 'camera') {
    if (!asurite) return
    setAttachOpen(false)
    if (fileRef.current) {
      fileRef.current.capture = source === 'camera' ? 'environment' : ''
      fileRef.current.click()
    }
  }

  function scrollToEnd() {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }

  useEffect(() => {
    scrollToEnd()
  }, [turns.length, phase])

  // A transcription that failed, or came back empty because the clip was
  // silent, must not leave the composer disabled behind a spinner forever. A
  // successful transcript has already moved the phase on to 'thinking', so this
  // only fires when nothing is coming.
  if ((voice.state === 'idle' || voice.state === 'error') && phase === 'transcribing') {
    setPhase(turns.length ? 'done' : 'idle')
  }


  const isEmpty = turns.length === 0 && phase === 'idle'

  return (
    <>
      {/* Ambient ASU-maroon glow behind the composer */}
      <div
        aria-hidden
        className={`ambient-glow pointer-events-none absolute inset-x-0 bottom-0 h-[62%] transition-opacity duration-700 ${
          isEmpty ? '' : 'ambient-glow--dim'
        }`}
      />

      <div ref={scrollRef} className="thin-scroll relative z-10 w-full flex-1 overflow-y-auto">
        {/* Scroller spans the full width so its bar sits at the window edge;
            the thread itself stays a centred, readable column. */}
        <div className="mx-auto w-full max-w-[820px] px-5 pb-8">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center pb-24">
            <Sparkle className="size-[52px]" />
            <h1 className="text-fg mt-5 max-w-[19ch] text-center text-[clamp(26px,7.6vw,32px)] leading-[1.18] font-normal tracking-[-0.03em]">
              {asurite ? 'Where should we start?' : 'Meet ASU Guide, your personal campus assistant'}
            </h1>
          </div>
        ) : (
          <div className="flex flex-col gap-7 pt-2">
            {turns.map((t, i) => {
              const streamingLast = phase === 'streaming' && i === turns.length - 1
              const cards = t.events && t.events.length > 0 ? t.events : t.kind === 'events' ? events : []

              return t.role === 'user' ? (
                <div key={t.id} className="flex flex-col items-end gap-2">
                  {t.mediaUrl && (t.mediaKind === 'video'
                    ? <video src={t.mediaUrl} muted loop autoPlay playsInline className="animate-rise max-h-56 max-w-[70%] rounded-3xl object-cover" />
                    : /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={t.mediaUrl} alt="Media you sent" className="animate-rise max-h-56 max-w-[70%] rounded-3xl object-cover" />)}
                  <p className="bg-surface-2 text-fg animate-rise max-w-[85%] rounded-3xl px-5 py-3.5 text-[17px] leading-[1.4] tracking-[-0.01em]">{t.content}</p>
                </div>
              ) : (
                <div key={t.id}>
                  <div className="text-fg text-[17px] leading-[1.55] tracking-[-0.01em]">
                    <RichText text={t.content} />
                    {streamingLast && (<span className="bg-fg/80 ml-0.5 inline-block h-[17px] w-[2px] translate-y-[2px] animate-pulse" />)}
                  </div>
                  {t.meta && (<p className="animate-rise text-muted mt-4 text-[12.5px]">Read by <span className="text-fg/80">{t.meta.model}</span> on ASU AIR in {(t.meta.ms / 1000).toFixed(1)}s{t.meta.note ? ` · ${t.meta.note}` : ''}</p>)}
                  {cards.length > 0 && (
                    <>
                      <h2 className="animate-rise mt-6 text-[17px] font-bold text-white">Coming up near you</h2>
                      <ul className="mt-3 flex flex-col gap-3">
                        {cards.map((e, i) => (<EventCard key={e.id} event={e} index={i} />))}
                      </ul>
                    </>
                  )}
                </div>
              )
            })}
            {phase === 'transcribing' && (
              <div className="flex justify-end">
                <p className="bg-surface-2 animate-rise rounded-3xl px-5 py-3.5">
                  <span role="status" aria-label="Transcribing" className="border-muted/40 border-t-fg/80 my-[3px] block size-[17px] animate-spin rounded-full border-2" />
                </p>
              </div>
            )}
            {phase === 'thinking' && (<p className="shimmer-text text-[17px] font-medium">Thinking…</p>)}
          </div>
        )}
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[820px] shrink-0 px-4 pb-5">
        {isEmpty && (
          <div className="no-scroll -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {[
              "What's happening this week?",
              'Find me a coding club',
              'Something social tonight',
              'Free food on campus',
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
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

        <AttachSheet
          open={attachOpen}
          onClose={() => setAttachOpen(false)}
          onPick={pickFile}
          locked={!asurite}
        />

        {voice.error && (
          <p role="alert" className="mt-2 px-2 text-center text-[12.5px] text-red-400/90">
            {voice.error}
          </p>
        )}
      </div>
    </>
  )
}