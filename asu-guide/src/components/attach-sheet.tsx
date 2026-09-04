'use client'

import { useEffect, useRef } from 'react'
import { CameraIcon, Paperclip, PhotoStack } from '@/components/icons'

/**
 * Bottom sheet raised by the composer's + button. Only the image paths are
 * wired — everything here routes to the same file picker, filtered to images.
 */
export function AttachSheet({
  open,
  onClose,
  onPick,
  locked = false,
}: {
  open: boolean
  onClose: () => void
  onPick: (source: 'files' | 'photos' | 'camera') => void
  /** Signed out: sharing media is gated behind an ASURITE. */
  locked?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // The backdrop only covers the chat stage, so a click on the header, the
  // side nav or the composer's own + button landed outside it and left the
  // sheet open. Listen at the window instead: any pointerdown outside the
  // panel closes it. pointerdown, not click, so the trigger's own onClick
  // cannot reopen what this just closed.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      // The + button toggles on its own click; closing here too would reopen it.
      if (t?.closest('[data-attach-trigger]')) return
      if (!panelRef.current?.contains(t)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
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

      <div
        ref={panelRef}
        className="animate-sheet-in relative mx-auto mb-[92px] w-[calc(100%-24px)] max-w-[440px] rounded-3xl bg-[#1e1f20] p-3 shadow-2xl shadow-black/60"
      >
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
                aria-label={label}
                title={label}
                className="flex w-[84px] flex-col items-center gap-1.5 rounded-2xl py-2 transition-colors hover:bg-white/5 active:scale-95"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-[#2a2b2c]">
                  <Icon className="text-fg size-5" />
                </span>
                <span className="text-fg text-[13px]">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
