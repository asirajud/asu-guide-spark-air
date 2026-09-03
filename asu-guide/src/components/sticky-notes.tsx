'use client'

import { useState } from 'react'
import { Close, SendArrow } from '@/components/icons'
import type { StickyNote } from '@/hooks/use-sticky-notes'

/** What a nudged note is wrapped in before it reaches Sol, verbatim as the student asked for it. */
export const NUDGE_PREFIX = "I'm pasting this from my sticky notes, can you help answer?"

/**
 * The board on the far right of a notebook. Plain text, this browser only, no
 * model involved — until the student nudges a note, which sends it into the
 * notebook chat and strikes it through here as done.
 */
export function StickyNotes({
  notes,
  canNudge,
  onAdd,
  onNudge,
  onRemove,
}: {
  notes: StickyNote[]
  /** False until at least one page has been read; Sol has nothing to answer against before that. */
  canNudge: boolean
  onAdd: (text: string) => void
  onNudge: (note: StickyNote) => void
  onRemove: (id: string) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }

  const open = notes.filter((n) => !n.done)
  const done = notes.filter((n) => n.done)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-muted text-[13px] tracking-[0.06em] uppercase">Sticky notes</h2>
        <span className="text-muted text-[12.5px]">this device only</span>
      </div>

      <div className="rounded-2xl border border-[#ffc627]/25 bg-[#ffc627]/[0.07] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              add()
            }
          }}
          rows={3}
          placeholder="Jot something while you read…"
          aria-label="New sticky note"
          className="text-fg placeholder:text-muted/70 w-full resize-none bg-transparent text-[16px] leading-[1.45] outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-muted text-[12.5px]">⌘↩ to stick</span>
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="rounded-full bg-[#ffc627] px-3.5 py-1.5 text-[14px] font-medium text-black transition-opacity disabled:opacity-40"
          >
            Stick it
          </button>
        </div>
      </div>

      {notes.length === 0 && (
        <p className="text-muted px-1 text-[15px] leading-relaxed">
          Notes stay here, unread by anyone. Nudge one when you want Sol to take it into the chat.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {[...open, ...done].map((n) => (
          <li
            key={n.id}
            className={`group relative rounded-2xl border p-3 pr-10 text-[16px] leading-[1.45] whitespace-pre-wrap transition-colors ${
              n.done
                ? 'text-muted border-white/8 bg-white/[0.02] line-through decoration-white/40'
                : 'text-fg border-[#ffc627]/20 bg-[#ffc627]/[0.05]'
            }`}
          >
            {n.text}
            <button
              type="button"
              onClick={() => onRemove(n.id)}
              aria-label="Remove note"
              className="text-muted hover:text-fg absolute top-2 right-2 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <Close className="size-3.5" />
            </button>
            {!n.done && (
              <button
                type="button"
                onClick={() => onNudge(n)}
                disabled={!canNudge}
                title={canNudge ? 'Send to Sol' : 'Add and read a page first'}
                className="mt-2.5 flex items-center gap-1.5 rounded-full border border-[#ffc627]/40 px-3 py-1 text-[13.5px] text-[#ffc627] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-0 group-hover:disabled:opacity-40"
              >
                <SendArrow className="size-3.5" />
                Nudge Sol
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
