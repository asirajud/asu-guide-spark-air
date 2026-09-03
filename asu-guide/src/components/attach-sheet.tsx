'use client'

import { useEffect } from 'react'
import { CameraIcon, Paperclip, PhotoStack } from '@/components/icons'

/**
 * Bottom sheet raised by the composer's + button. Only the image paths are
 * wired — everything here routes to the same file picker, filtered to images.
 */
export function AttachSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (source: 'files' | 'photos' | 'camera') => void
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

      <div className="animate-sheet-in relative mx-3 mb-[92px] w-full rounded-3xl bg-[#1e1f20] p-4 shadow-2xl shadow-black/60">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/20" />

        <div className="flex justify-center gap-3">
          {actions.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className="flex w-[92px] flex-col items-center gap-2 rounded-2xl py-3 transition-colors hover:bg-white/5 active:scale-95"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-[#2a2b2c]">
                <Icon className="text-fg size-[22px]" />
              </span>
              <span className="text-fg text-[13px]">{label}</span>
            </button>
          ))}
        </div>

        <p className="text-muted mt-3 px-1 text-center text-[12px] leading-snug">
          Images and video are read on ASU AIR — <span className="text-fg/80">gemma4-31b-it</span>,{' '}
          <span className="text-fg/80">qwen3-vl-32b</span> and{' '}
          <span className="text-fg/80">qwen3-asr</span>.
        </p>
      </div>
    </div>
  )
}
