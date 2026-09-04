'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AttachSheet } from '@/components/attach-sheet'
import { Composer } from '@/components/composer'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { downscaleImage } from '@/lib/image'
import { EventList } from '@/components/event-list'
import { HeatRouteCard } from '@/components/heatroute-card'
import { WeatherCard } from '@/components/weather-card'
import type { HeatRoutePlan, WeatherReport } from '@/lib/tools'
import { RichText } from '@/components/rich-text'
import { capitaliseReply } from '@/lib/capitalise'
import Image from 'next/image'
import { ToolTrace } from '@/components/tool-trace'
import type { DemoEvent } from '@/lib/events'
import type { ToolStep, TraceEvent } from '@/lib/tool-trace'

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
  /** A HeatRoute plan the assistant obtained on this turn, drawn as a map card. */
  heatroute?: HeatRoutePlan | null
  /** A weather report the assistant obtained on this turn, drawn as an hourly card. */
  weather?: WeatherReport | null
  /** "Read by X on ASU AIR in 2.1s" footnote for a media reply. */
  meta?: { model: string; ms: number; note?: string } | null
  /** Tool calls the assistant made on this turn, in order, failures included. */
  trace?: ToolStep[]
  /** Rehydrated from SQLite — its cited cards were not stored. */
  restored?: boolean
  /** Sent to the model but not drawn: what a vision model read off an image. */
  hidden?: boolean
}

type ChatDone = Extract<TraceEvent, { type: 'done' }>

let seq = 0
const uid = () => `t${Date.now().toString(36)}-${seq++}`

type Phase = 'idle' | 'transcribing' | 'thinking' | 'streaming' | 'done'

export function Chat({
  events,
  asurite,
  onTurn,
  restoredTurns,
  deep = false,
}: {
  events: DemoEvent[]
  asurite?: string | null
  /** Called once a turn is final, so the shell can persist it. */
  onTurn?: (t: {
    role: 'user' | 'assistant'
    content: string
    kind: string
    imageName?: string | null
    /** What was drawn with the reply, so a restored chat can draw it again. */
    payload?: { events?: DemoEvent[]; heatroute?: HeatRoutePlan; weather?: WeatherReport } | null
  }) => void
  restoredTurns?: Turn[] | null
  /** Deep thinking, picked from the header's mode menu; the shell owns it. */
  deep?: boolean
}) {
  const [turns, setTurns] = useState<Turn[]>(restoredTurns ?? [])
  const [phase, setPhase] = useState<Phase>(restoredTurns?.length ? 'done' : 'idle')
  const [draft, setDraft] = useState('')
  /** Tool calls of the turn in flight, drawn live under "Thinking…". */
  const [liveTrace, setLiveTrace] = useState<ToolStep[]>([])
  const [attachment, setAttachment] = useState<{
    file: File
    url: string
    kind: 'image' | 'video'
  } | null>(null)
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
    trace: ToolStep[] = [],
    heatroute: HeatRoutePlan | null = null,
    weather: WeatherReport | null = null,
  ) {
    const body = full.trim() || 'Sorry — I did not get an answer that time.'
    const id = uid()
    setTurns((t) => [
      ...t,
      { id, role: 'assistant', content: '', kind, events: cards, meta, trace, heatroute, weather },
    ])
    setLiveTrace([])
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
            onTurn?.({
              role: 'assistant',
              content: body,
              kind,
              payload:
                cards.length || heatroute
                  ? {
                      ...(cards.length ? { events: cards } : {}),
                      ...(heatroute ? { heatroute } : {}),
                    }
                  : null,
            })
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

    const trace: ToolStep[] = []
    try {
      const final = await runChat(next, trace)
      const cards = (final.events as DemoEvent[]) ?? []
      appendAssistant(
        final.text,
        cards.length ? 'events' : 'text',
        cards,
        null,
        trace,
        (final.heatroute as HeatRoutePlan | undefined) ?? null,
        (final.weather as WeatherReport | undefined) ?? null,
      )
    } catch (err) {
      appendAssistant(
        err instanceof Error ? err.message : 'Something went wrong.',
        'text',
        [],
        null,
        trace,
      )
    }
  }

  /**
   * Post a thread to /api/chat and read its stream. The route answers with
   * newline-delimited JSON: one line per tool call starting and finishing, then
   * a final `done` (or `error`). Each line updates `trace` and the live view;
   * nothing is written to the thread until `done`, which is returned.
   */
  async function runChat(thread: Turn[], trace: ToolStep[]): Promise<ChatDone> {
    const applyTrace = (ev: TraceEvent) => {
      if (ev.type === 'tool_start') {
        trace.push({
          id: ev.id,
          name: ev.name,
          label: ev.label,
          status: 'running',
          round: ev.round,
        })
      } else if (ev.type === 'tool_end') {
        const step = trace.find((s) => s.id === ev.id)
        if (step) {
          step.status = ev.ok ? 'ok' : 'error'
          step.ms = ev.ms
          step.summary = ev.summary
        }
      }
      setLiveTrace([...trace.map((s) => ({ ...s }))])
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: thread.map((t) => ({
          role: t.role,
          content: t.content,
          kind: t.hidden ? 'media' : t.kind,
        })),
        deep,
      }),
    })
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'No answer came back.')
    }

    let final: TraceEvent | null = null
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        const ev = JSON.parse(line) as TraceEvent
        if (ev.type === 'done' || ev.type === 'error') final = ev
        else applyTrace(ev)
      }
    }

    if (!final) throw new Error('The answer was cut off.')
    if (final.type === 'error') throw new Error(final.error)
    return final
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
   * Image path, two stages. A vision model on AIR (gemma4-31b-it) only READS the
   * picture — for a flyer: name, club, date, time, place. That reading is folded
   * into the thread as a hidden turn, and the chat model, which has the tools,
   * answers the student's actual question: "sign me up for this" becomes
   * search_events → reserve_spot, live, with the trace on screen.
   */
  async function sendImage(file: File, question: string, previewUrl: string) {
    const q = question || 'What is this?'
    const userTurn: Turn = {
      id: uid(),
      role: 'user',
      content: q,
      kind: 'vision',
      mediaUrl: previewUrl,
      mediaKind: 'image',
    }
    setTurns((t) => [...t, userTurn])
    setDraft('')
    setPhase('thinking')
    onTurn?.({ role: 'user', content: q, kind: 'vision', imageName: file.name })

    const trace: ToolStep[] = []
    try {
      const body = new FormData()
      body.append('image', await downscaleImage(file))
      if (question) body.append('prompt', question)

      const res = await fetch('/api/vision', { method: 'POST', body })
      const data = (await res.json()) as {
        text?: string
        error?: string
        model?: string
        ms?: number
      }
      if (!res.ok || !data.text) throw new Error(data.error ?? 'Could not read that image.')

      const reading: Turn = {
        id: uid(),
        role: 'assistant',
        content: data.text,
        kind: 'vision',
        hidden: true,
      }
      setTurns((t) => [...t, reading])
      onTurn?.({ role: 'assistant', content: data.text, kind: 'media' })

      // The reading goes in AHEAD of the question so the chat model sees the
      // flyer before it decides what to do about it.
      const thread = [...turns, reading, { ...userTurn, kind: 'text' as const }]
      const final = await runChat(thread, trace)
      const cards = (final.events as DemoEvent[]) ?? []
      appendAssistant(
        final.text,
        cards.length ? 'events' : 'text',
        cards,
        { model: `${data.model ?? 'AIR vision'} + ${final.model}`, ms: (data.ms ?? 0) + final.ms },
        trace,
        (final.heatroute as HeatRoutePlan | undefined) ?? null,
        (final.weather as WeatherReport | undefined) ?? null,
      )
    } catch (err) {
      appendAssistant(
        err instanceof Error ? err.message : 'Something went wrong reading that image.',
        'text',
        [],
        null,
        trace,
      )
    }
  }

  /**
   * Video path — ffmpeg splits the clip, a vision model watches it and an ASR
   * model listens, then a third model fuses the two. All on AIR.
   */
  async function sendVideo(file: File, question: string, previewUrl: string) {
    const q = question || 'What happens in this video?'
    setTurns((t) => [
      ...t,
      {
        id: uid(),
        role: 'user',
        content: q,
        kind: 'vision',
        mediaUrl: previewUrl,
        mediaKind: 'video',
      },
    ])
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
      appendAssistant(
        err instanceof Error ? err.message : 'Something went wrong reading that video.',
        'text',
      )
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
        {/* h-full only while empty: the hero centres in the scroller, but a real
            thread has to be free to grow past it. */}
        <div className={`mx-auto w-full max-w-[820px] px-5 pb-8 ${isEmpty ? 'h-full' : ''}`}>
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center pb-24">
              <Image
                src="/mark-brain.png"
                alt=""
                width={64}
                height={64}
                priority
                className="size-[64px] drop-shadow-[0_0_18px_rgba(255,198,39,0.25)]"
              />
              <h1 className="text-fg mt-5 max-w-[19ch] text-center text-[clamp(26px,7.6vw,32px)] leading-[1.18] font-normal tracking-[-0.03em]">
                {asurite ? 'Where should we start?' : 'Meet Sol, your personal campus assistant'}
              </h1>
            </div>
          ) : (
            <div className="flex flex-col gap-7 pt-2">
              {turns.map((t, i) => {
                if (t.hidden) return null
                const streamingLast = phase === 'streaming' && i === turns.length - 1
                const cards =
                  t.events && t.events.length > 0 ? t.events : t.kind === 'events' ? events : []

                return t.role === 'user' ? (
                  <div key={t.id} className="flex flex-col items-end gap-2">
                    {t.mediaUrl &&
                      (t.mediaKind === 'video' ? (
                        <video
                          src={t.mediaUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          className="animate-rise max-h-56 max-w-[70%] rounded-3xl object-cover"
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={t.mediaUrl}
                          alt="Media you sent"
                          className="animate-rise max-h-56 max-w-[70%] rounded-3xl object-cover"
                        />
                      ))}
                    <p className="bg-surface-2 text-fg animate-rise max-w-[85%] rounded-3xl px-5 py-3.5 text-[17px] leading-[1.4] tracking-[-0.01em]">
                      {t.content}
                    </p>
                  </div>
                ) : (
                  <div key={t.id}>
                    {t.trace && t.trace.length > 0 && <ToolTrace steps={t.trace} />}
                    <div className="text-fg text-[17px] leading-[1.55] tracking-[-0.01em]">
                      {/* Normalised at render, not on receipt, so conversations
                          already stored lowercase come back looking right. */}
                      <RichText text={capitaliseReply(t.content)} />
                      {streamingLast && (
                        <span className="bg-fg/80 ml-0.5 inline-block h-[17px] w-[2px] translate-y-[2px] animate-pulse" />
                      )}
                    </div>
                    {t.meta && (
                      <p className="animate-rise text-muted mt-4 text-[12.5px]">
                        {t.trace && t.trace.length > 0 ? 'Read and answered by' : 'Read by'}{' '}
                        <span className="text-fg/80">{t.meta.model}</span> on ASU AIR in{' '}
                        {(t.meta.ms / 1000).toFixed(1)}s{t.meta.note ? ` · ${t.meta.note}` : ''}
                      </p>
                    )}
                    {cards.length > 0 && <EventList events={cards} />}
                    {t.heatroute && <HeatRouteCard plan={t.heatroute} />}
                    {t.weather && <WeatherCard report={t.weather} />}
                  </div>
                )
              })}
              {phase === 'transcribing' && (
                <div className="flex justify-end">
                  <p className="bg-surface-2 animate-rise rounded-3xl px-5 py-3.5">
                    <span
                      role="status"
                      aria-label="Transcribing"
                      className="border-muted/40 border-t-fg/80 my-[3px] block size-[17px] animate-spin rounded-full border-2"
                    />
                  </p>
                </div>
              )}
              {phase === 'thinking' && (
                <div className="flex flex-col gap-3">
                  <ToolTrace steps={liveTrace} live />
                  <p className="shimmer-text text-[17px] font-medium">
                    {liveTrace.some((s) => s.status === 'running')
                      ? 'Working…'
                      : deep
                        ? 'Thinking deeply…'
                        : 'Thinking…'}
                  </p>
                </div>
              )}
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
            const kind =
              file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name)
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
