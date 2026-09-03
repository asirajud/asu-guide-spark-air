'use client'

import { Close, Mic, Plus, SendArrow } from '@/components/icons'
import type { VoiceState } from '@/hooks/use-voice-input'

export function Composer({
  value,
  onChange,
  onSubmit,
  inputRef,
  voiceState = 'idle',
  voiceLevel = 0,
  onMicToggle,
  onAttachClick,
  attachment = null,
  onClearAttachment,
  attachOpen = false,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  inputRef?: React.Ref<HTMLInputElement>
  voiceState?: VoiceState
  voiceLevel?: number
  onMicToggle?: () => void
  onAttachClick?: () => void
  attachment?: { url: string; name: string; kind?: 'image' | 'video' } | null
  onClearAttachment?: () => void
  attachOpen?: boolean
}) {
  const recording = voiceState === 'recording'
  const transcribing = voiceState === 'transcribing'

  // The mic is the resting control. The moment there is text or a staged
  // attachment it becomes a send button, so there is always one obvious way to
  // send — Enter still submits either way. The old blue "live speak" waveform
  // button is deferred; it is not rendered at all.
  const canSend = value.trim().length > 0 || Boolean(attachment)
  const showSend = canSend && !recording && !transcribing

  return (
    <div className="flex flex-col gap-2">
      {attachment && (
        <div className="bg-surface-2 flex items-center gap-3 self-start rounded-2xl p-2 pr-3">
          {attachment.kind === 'video' ? (
            <video src={attachment.url} muted className="size-11 rounded-xl object-cover" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={attachment.url}
              alt={attachment.name}
              className="size-11 rounded-xl object-cover"
            />
          )}
          <span className="text-fg max-w-[180px] truncate text-[13px]">{attachment.name}</span>
          <button
            type="button"
            onClick={onClearAttachment}
            aria-label="Remove image"
            className="text-muted hover:text-fg rounded-full p-1 transition-colors"
          >
            <Close className="size-4" />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="bg-surface-2 flex h-16 items-center gap-3 rounded-full pr-5 pl-4"
      >
        <button
          type="button"
          onClick={onAttachClick}
          aria-label={attachOpen ? 'Close attachment menu' : 'Add an image'}
          aria-expanded={attachOpen}
          className="text-fg/90 p-1 transition-transform duration-200"
          style={{ transform: attachOpen ? 'rotate(45deg)' : undefined }}
        >
          <Plus className="size-[26px]" />
        </button>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={transcribing}
          placeholder={recording ? 'Listening…' : 'Ask ASU Guide'}
          aria-label="Ask ASU Guide"
          autoComplete="off"
          className="text-fg placeholder:text-muted min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.01em] outline-none disabled:opacity-50"
        />

        {showSend ? (
          <button
            type="submit"
            aria-label="Send"
            className="bg-asu-gold text-asu-accent-fg flex size-9 items-center justify-center rounded-full transition-transform active:scale-95"
          >
            <SendArrow className="size-[19px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMicToggle}
            disabled={transcribing}
            aria-label={recording ? 'Stop recording' : 'Voice input'}
            aria-pressed={recording}
            className={
              recording
                ? 'relative flex size-9 items-center justify-center rounded-full bg-red-500/90 text-white transition-colors'
                : 'text-fg/90 p-1 transition-colors disabled:opacity-40'
            }
          >
            {recording && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-red-500/40"
                style={{
                  transform: `scale(${1 + Math.min(voiceLevel, 1) * 0.55})`,
                  transition: 'transform 90ms linear',
                }}
              />
            )}
            <Mic className="relative size-[23px]" />
          </button>
        )}
      </form>
    </div>
  )
}
