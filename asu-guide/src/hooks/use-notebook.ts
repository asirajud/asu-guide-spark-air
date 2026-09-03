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
}
export type IngestProgress = { done: number; total: number; current: number | null }

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
        notebook: NotebookInfo
        pages: Array<Omit<NotebookPage, 'status' | 'previewUrl'> & { status: 'read' | 'failed' }>
      }
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

  const addPages = useCallback(
    async (files: File[]) => {
      if (!id || ingesting || files.length === 0) return

      setIngesting(true)
      setProgress({ done: 0, total: files.length, current: null })

      try {
        const previewUrls: string[] = []
        const downscaledFiles: File[] = []

        // Downscale each file sequentially and build preview URLs
        for (let i = 0; i < files.length; i++) {
          downscaledFiles.push(await downscaleImage(files[i]))
          previewUrls.push(URL.createObjectURL(files[i]))
        }

        const formData = new FormData()
        for (let i = 0; i < downscaledFiles.length; i++) {
          formData.append('pages', downscaledFiles[i])
        }

        const res = await fetch(`/api/notebooks/${id}/ingest`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? 'Upload failed.')
          return
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        if (!reader) {
          setError('Upload failed. Check the ASU VPN and try again.')
          return
        }

        // Positions are notebook-wide (a second upload starts at 4), so the
        // k-th page_start of THIS upload gets the k-th preview, not previews[position].
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
                previewUrl: previewUrls[started++],
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
        // Don't revoke object URLs - keep them visible
      }
    },
    [id, ingesting],
  )

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || !id || asking) return

      const userTurn: NotebookTurn = {
        id: crypto.randomUUID(),
        role: 'user',
        content: q,
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
