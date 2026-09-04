'use client'

import { useEffect } from 'react'
import { CameraIcon, Paperclip, PhotoStack } from '@/components/icons'

function DeepIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
      <path d="M10 20h4" strokeLinecap="round" />
      <path d="M12 7v3l2 1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Bottom sheet raised by the composer's + button. Only the image paths are
 * wired — everything here routes to the same file picker, filtered to images.
 */
export function AttachSheet({
  open,
  onClose,
  onPick,
  locked = false,
  deep = false,
  onToggleDeep,
}: {
  open: boolean
  onClose: () => void
  onPick: (source: 'files' | 'photos' | 'camera') => void
  /** Signed out: sharing media is gated behind an ASURITE. */
  locked?: boolean
  /** Deep thinking: the next turns run on the slower reasoning model. */
  deep?: boolean
  onToggleDeep?: (next: boolean) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const actions = [
    { id: 'files' as const, label: 'Files', Icon: Paperclip },
    { id: 'photos' as const, label: 'Photos', Icon: PhotoStack },
    { id: 'camera' as const, label: 'Record', Icon: CameraIcon },
  ]

  return (
    <div className="absolute inset-0 z-30 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close attachment menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      <div className="animate-sheet-in relative mx-auto mb-[92px] w-[calc(100%-24px)] max-w-[440px] rounded-3xl bg-[#1e1f20] p-3 shadow-2xl shadow-black/60">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />

        {locked ? (
          <div className="px-3 pt-1 pb-2 text-center">
            <p className="text-fg text-[16px] leading-snug font-medium">
              Sign in to share photos and video
            </p>
            <p className="text-muted mx-auto mt-2 max-w-[36ch] text-[13.5px] leading-relaxed">
              Media you share is read by models running on ASU&apos;s own hardware and kept with
              your account, so it needs an ASURITE.
            </p>
            <a
              href="/api/auth/login"
              className="bg-asu-maroon mt-4 inline-flex h-11 items-center rounded-full px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#a52350] active:scale-95"
            >
              Sign in
            </a>
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            {actions.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onPick(id)}
                className="flex w-[84px] flex-col items-center gap-1.5 rounded-2xl py-2 transition-colors hover:bg-white/5 active:scale-95"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-[#2a2b2c]">
                  <Icon className="text-fg size-5" />
                </span>
                <span className="text-fg text-[13px]">{label}</span>
              </button>
            ))}
            {onToggleDeep && (
              <button
                type="button"
                role="switch"
                aria-checked={deep}
                onClick={() => onToggleDeep(!deep)}
                title="Slower, more careful answers from a reasoning model on AIR"
                className="flex w-[84px] flex-col items-center gap-1.5 rounded-2xl py-2 transition-colors hover:bg-white/5 active:scale-95"
              >
                <span
                  className={`relative flex size-12 items-center justify-center rounded-full transition-colors ${
                    deep ? 'bg-[#ffc627] text-black' : 'bg-[#2a2b2c] text-fg'
                  }`}
                >
                  <DeepIcon className="size-5" />
                  {deep && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-[#1e1f20] bg-[#ffc627]"
                    />
                  )}
                </span>
                <span className={`text-[13px] ${deep ? 'text-[#ffc627]' : 'text-fg'}`}>
                  {deep ? 'Deep · on' : 'Deep'}
                </span>
              </button>
            )}
          </div>
        )}

        {!locked && (
          <p className="text-muted mt-2 px-1 text-center text-[12px] leading-snug">
            Media is read on ASU AIR by <span className="text-fg/80">gemma4-31b-it</span>,{' '}
            <span className="text-fg/80">qwen3-vl-32b</span> and{' '}
            <span className="text-fg/80">qwen3-asr</span>. Deep switches the answer to{' '}
            <span className="text-fg/80">gpt-oss-120b</span>, slower and more careful.
          </p>
        )}
      </div>
    </div>
  )
}
