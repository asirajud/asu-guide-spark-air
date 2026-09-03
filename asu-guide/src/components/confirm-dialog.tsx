'use client'

import { useEffect, useRef } from 'react'

/**
 * A modal confirm, drawn in the app's own style. The repo rule is no native
 * prompt()/alert()/confirm(): they render in system chrome, cannot be styled,
 * and block the whole tab.
 *
 * Focus lands on Cancel when it opens, so a stray Enter never deletes anything;
 * Escape and a backdrop click both cancel.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="animate-rise fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#141415] p-6 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-[20px] font-medium tracking-[-0.02em] text-white">
          {title}
        </h2>
        <p id="confirm-body" className="text-muted mt-2 text-[16px] leading-relaxed">
          {body}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="text-fg rounded-full border border-white/12 px-5 py-2.5 text-[15.5px] transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-full bg-[#8c1d40] px-5 py-2.5 text-[15.5px] font-medium text-white transition-colors hover:bg-[#a3234b] disabled:opacity-50"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
