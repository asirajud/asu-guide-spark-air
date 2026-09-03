'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { downscaleImage } from '@/lib/image'

/**
 * Pages update one at a time because the route reads sequentially and streams
 * the results as they're processed. Previews are per-session only because
 * object URLs are only valid for the current browser session.
 */
export type PageStatus = 'queued' | 'reading' | 'read' | 'failed'
export type NotebookPage = {
  position: number
  imageName: string
  reading: string
  status: PageStatus
  model: string
  ms: number
  error?: string
  /** Object URL for a page uploaded in this session; saved pages have none. */
  previewUrl?: string
}
export type NotebookInfo = {
  id: string
  name: string
  digest: string
  digestModel: string
  updatedAt: number
}
export type NotebookTurn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  meta?: { model: string; ms: number }
  /** 'sticky' when the turn was nudged in from the sticky board, so the UI can say so. */
  source?: 'sticky'
  /** For a sticky turn: the note as written, without the framing sent to the model. */
  display?: string
}
export type IngestProgress = { done: number; total: number; current: number | null }
export type QueuedPage = { imageName: string; previewUrl: string }

/** Until the server says otherwise. Mirrors NOTEBOOK_PAGE_CAP_DEFAULT in lib/app-settings.ts. */
const DEFAULT_CAP = 10

type IngestEvent =
  | { type: 'page_start'; position: number; name: string }
  | {
      type: 'page_read'
      position: number
      status: 'read' | 'failed'
      reading: string
      model: string
      ms: number
      error?: string
    }
  | { type: 'digest'; position: number; digest: string; model: string; ms: number }
  | { type: 'renamed'; name: string; model: string }
  | { type: 'done'; pages: number; digest: string }
  | { type: 'error'; error: string }

export function useNotebook(id: string | null) {
  const [notebook, setNotebook] = useState<NotebookInfo | null>(null)
  const [pages, setPages] = useState<NotebookPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ingesting, setIngesting] = useState(false)
  const [progress, setProgress] = useState<IngestProgress | null>(null)
  const [turns, setTurns] = useState<NotebookTurn[]>([])
  const [asking, setAsking] = useState(false)
  /** Pages this notebook may hold in total, as the server reports it. */
  const [cap, setCap] = useState(DEFAULT_CAP)
  /** Waiting for the running batch to finish; shown as 'queued' rows. */
  const [queued, setQueued] = useState<QueuedPage[]>([])
  const queueRef = useRef<{ file: File; previewUrl: string }[]>([])
  /** Set when a rename arrived from the server (auto-title), so the shell can refresh its list. */
  const [renamedTo, setRenamedTo] = useState<string | null>(null)

  /** Latest turns, so a follow-up question posts the full thread even mid-render. */
  const turnsRef = useRef<NotebookTurn[]>([])
  turnsRef.current = turns

  const reload = useCallback(async () => {
    if (!id) return

    try {
      const res = await fetch(`/api/notebooks/${id}`)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not load this notebook.')
        return
      }

      const data = (await res.json()) as {
        cap?: number
        notebook: NotebookInfo
        pages: Array<Omit<NotebookPage, 'status' | 'previewUrl'> & { status: 'read' | 'failed' }>
      }
      if (typeof data.cap === 'number') setCap(data.cap)
      setNotebook(data.notebook)
      setPages(data.pages.map((p) => ({ ...p, status: p.status || 'read' })))
      setError(null)
    } catch {
      setError('Could not load this notebook.')
    }
  }, [id])

  useEffect(() => {
    // The component is remounted for each new notebook id, so fresh state is guaranteed
    if (!id) return
    let cancelled = false
    void (async () => {
      await reload()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, reload])

  /** Send one batch to the ingest route and apply its NDJSON events as they arrive. */
  const runBatch = useCallback(
    async (items: { file: File; previewUrl: string }[]) => {
      if (!id || items.length === 0) return
      setQueued([])
      setIngesting(true)
      setProgress({ done: 0, total: items.length, current: null })

      try {
        const formData = new FormData()
        for (const item of items) formData.append('pages', await downscaleImage(item.file))

        const res = await fetch(`/api/notebooks/${id}/ingest`, { method: 'POST', body: formData })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? 'Upload failed.')
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setError('Upload failed. Check the ASU VPN and try again.')
          return
        }
        const decoder = new TextDecoder()
        let buffer = ''
        // Positions are notebook-wide (a second batch starts at 4), so the k-th
        // page_start of THIS batch gets the k-th preview, not previews[position].
        let started = 0

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line) continue

            const ev = JSON.parse(line) as IngestEvent

            if (ev.type === 'page_start') {
              const page: NotebookPage = {
                position: ev.position,
                imageName: ev.name,
                reading: '',
                status: 'reading',
                model: '',
                ms: 0,
                previewUrl: items[started++]?.previewUrl,
              }
              setPages((prev) => {
                const at = prev.findIndex((p) => p.position === ev.position)
                if (at < 0) return [...prev, page]
                const next = [...prev]
                next[at] = page
                return next
              })
              setProgress((p) => (p ? { ...p, current: ev.position } : null))
            } else if (ev.type === 'page_read') {
              setPages((prev) =>
                prev.map((p) =>
                  p.position === ev.position
                    ? {
                        ...p,
                        status: ev.status,
                        reading: ev.reading,
                        model: ev.model,
                        ms: ev.ms,
                        error: ev.error,
                      }
                    : p,
                ),
              )
              setProgress((p) => (p ? { ...p, done: p.done + 1 } : null))
            } else if (ev.type === 'digest') {
              setNotebook((n) =>
                n ? { ...n, digest: ev.digest, digestModel: ev.model, updatedAt: Date.now() } : n,
              )
            } else if (ev.type === 'renamed') {
              setNotebook((n) => (n ? { ...n, name: ev.name } : n))
              setRenamedTo(ev.name)
            } else if (ev.type === 'error') {
              setError(ev.error)
            }
          }
        }
      } catch {
        setError('Upload failed. Check the ASU VPN and try again.')
      } finally {
        setIngesting(false)
        setProgress((p) => (p ? { ...p, current: null } : null))
        // Object URLs are kept so the thumbnails stay visible for the session.
      }
    },
    [id],
  )

  /**
   * Queue pages. They can be added while a batch is still being read; the
   * effect below sends the next batch as soon as the current one finishes, so
   * reading stays strictly sequential and each page still sees the digest of
   * every page before it. Anything past the notebook's cap is refused here so
   * the student hears about it before the upload, not after.
   */
  const addPages = useCallback(
    (files: File[]) => {
      if (!id) return
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      const room = cap - pages.length - queueRef.current.length
      if (room <= 0) {
        setError(`This notebook holds at most ${cap} pages.`)
        return
      }
      const accepted = images.slice(0, room)
      setError(
        accepted.length < images.length
          ? `This notebook holds at most ${cap} pages, so ${images.length - accepted.length} ${
              images.length - accepted.length === 1 ? 'was' : 'were'
            } left out.`
          : null,
      )
      queueRef.current.push(
        ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      )
      setQueued(queueRef.current.map((i) => ({ imageName: i.file.name, previewUrl: i.previewUrl })))
    },
    [id, cap, pages.length],
  )

  // Drain the queue: one batch at a time, started only when nothing is running.
  useEffect(() => {
    if (ingesting || queueRef.current.length === 0) return
    void runBatch(queueRef.current.splice(0))
  }, [ingesting, queued.length, runBatch])

  const ask = useCallback(
    async (question: string, opts?: { source: 'sticky'; display: string }) => {
      const q = question.trim()
      if (!q || !id || asking) return

      const userTurn: NotebookTurn = {
        id: crypto.randomUUID(),
        role: 'user',
        content: q,
        ...(opts ? { source: opts.source, display: opts.display } : {}),
      }

      setTurns((prev) => [...prev, userTurn])
      setAsking(true)

      try {
        const latestTurns = [...turnsRef.current, userTurn]
        const res = await fetch(`/api/notebooks/${id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: latestTurns.map((t) => ({
              role: t.role,
              content: t.content,
            })),
          }),
        })

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          const assistantTurn: NotebookTurn = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.error ?? 'Sol could not answer that. Check the ASU VPN and try again.',
          }
          setTurns((prev) => [...prev, assistantTurn])
          return
        }

        const data = (await res.json()) as { text: string; model?: string; ms?: number }
        const assistantTurn: NotebookTurn = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.text,
          meta: data.model && data.ms ? { model: data.model, ms: data.ms } : undefined,
        }
        setTurns((prev) => [...prev, assistantTurn])
      } catch {
        const assistantTurn: NotebookTurn = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sol could not answer that. Check the ASU VPN and try again.',
        }
        setTurns((prev) => [...prev, assistantTurn])
      } finally {
        setAsking(false)
      }
    },
    [id, asking],
  )

  const rename = useCallback(
    async (name: string) => {
      if (!id) return false

      try {
        const res = await fetch(`/api/notebooks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })

        if (!res.ok) return false

        setNotebook((prev) => (prev ? { ...prev, name } : prev))
        return true
      } catch {
        return false
      }
    },
    [id],
  )

  /** Deletes the notebook and its pages. True on success; the caller decides where to go next. */
  const remove = useCallback(async () => {
    if (!id) return false
    try {
      const res = await fetch(`/api/notebooks/${id}`, { method: 'DELETE' })
      return res.ok
    } catch {
      return false
    }
  }, [id])

  return {
    remove,
    cap,
    queued,
    renamedTo,
    notebook,
    pages,
    loading,
    error,
    ingesting,
    progress,
    addPages,
    turns,
    asking,
    ask,
    rename,
    reload,
  }
}
