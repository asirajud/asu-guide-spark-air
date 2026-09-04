'use client'

import { useCallback, useState } from 'react'

export type StickyNote = {
  id: string
  text: string
  /** Set once the note has been handed to Sol; it stays on the board, struck through. */
  done: boolean
  createdAt: number
}

const key = (notebookId: string) => `sol.notes.${notebookId}`

function read(notebookId: string): StickyNote[] {
  try {
    const raw = window.localStorage.getItem(key(notebookId))
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as StickyNote[]) : []
  } catch {
    return []
  }
}

function write(notebookId: string, notes: StickyNote[]) {
  try {
    window.localStorage.setItem(key(notebookId), JSON.stringify(notes))
  } catch {
    /* private mode or blocked storage: the board just does not persist */
  }
}

/**
 * Sticky notes for one notebook. Deliberately no model in the loop: a note is
 * plain text the student jots while reading, kept in this browser only. Sol
 * sees a note only when the student nudges it, and the caller decides what
 * that means (here: it becomes a chat turn and the note is marked done).
 */
export function useStickyNotes(notebookId: string) {
  // Lazy read on the client; the server has no storage and renders []. Safe
  // because the notebook view only paints its board after its own fetch, so
  // there is no server-rendered board to mismatch against.
  const [notes, setNotes] = useState<StickyNote[]>(() =>
    typeof window === 'undefined' ? [] : read(notebookId),
  )

  const update = useCallback(
    (fn: (prev: StickyNote[]) => StickyNote[]) => {
      setNotes((prev) => {
        const next = fn(prev)
        write(notebookId, next)
        return next
      })
    },
    [notebookId],
  )

  const add = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t) return
      update((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: t, done: false, createdAt: Date.now() },
      ])
    },
    [update],
  )

  const markDone = useCallback(
    (id: string) => update((prev) => prev.map((n) => (n.id === id ? { ...n, done: true } : n))),
    [update],
  )

  const remove = useCallback(
    (id: string) => update((prev) => prev.filter((n) => n.id !== id)),
    [update],
  )

  return { notes, add, markDone, remove }
}
