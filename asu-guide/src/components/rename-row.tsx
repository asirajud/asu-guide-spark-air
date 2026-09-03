'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Close } from '@/components/icons'

/**
 * The row's title, swapped for an input in place — same font, padding and pill
 * shape as the title it replaces, so nothing shifts when editing starts.
 *
 * The draft lives here rather than in SideNav on purpose: `Row` is declared
 * inside SideNav's body, so every SideNav render gives it a new component
 * identity and remounts the whole row. A draft held one level up would tear
 * down this input on every keystroke and drop focus with it.
 */
export function RenameRow({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  /** Resolves false when the PATCH failed, so the row can show the error. */
  onSave: (title: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  // Committing on blur would otherwise fire twice — once for the click that
  // moved focus to the save button, once for the button's own handler.
  const done = useRef(false)

  useEffect(() => {
    ref.current?.select()
  }, [])

  function commit() {
    if (done.current) return
    done.current = true
    const next = value.replace(/\s+/g, ' ').trim().slice(0, 80)
    // Emptying the field is a cancel, not a request for a blank title.
    if (!next || next === initial) onCancel()
    else void onSave(next)
  }

  function cancel() {
    if (done.current) return
    done.current = true
    onCancel()
  }

  return (
    <div className="flex w-full items-center gap-1 rounded-full bg-[#3a1723] py-1 pr-1 pl-4">
      <input
        ref={ref}
        value={value}
        aria-label="Rename conversation"
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') cancel()
          // The list's own Escape handler closes the whole drawer.
          e.stopPropagation()
        }}
        onBlur={commit}
        className="text-fg min-w-0 flex-1 bg-transparent py-1.5 text-[14.5px] font-medium outline-none"
      />
      {/* mousedown, not click: blur would commit and unmount the button first. */}
      <button
        type="button"
        aria-label="Save name"
        onMouseDown={(e) => {
          e.preventDefault()
          commit()
        }}
        className="text-muted hover:text-fg rounded-full p-1.5 transition-colors"
      >
        <Check className="size-[17px]" />
      </button>
      <button
        type="button"
        aria-label="Cancel rename"
        onMouseDown={(e) => {
          e.preventDefault()
          cancel()
        }}
        className="text-muted hover:text-fg rounded-full p-1.5 transition-colors"
      >
        <Close className="size-[17px]" />
      </button>
    </div>
  )
}
