'use client'

import { useEffect, useRef, useState } from 'react'
import { NotebookIcon, Plus, PhotoStack, Close, TrashIcon } from '@/components/icons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StickyNotes, StickyIcon, NUDGE_PREFIX } from '@/components/sticky-notes'
import { useStickyNotes, type StickyNote } from '@/hooks/use-sticky-notes'
import { Composer } from '@/components/composer'
import { RichText } from '@/components/rich-text'
import { useNotebook } from '@/hooks/use-notebook'
import type { NotebookPage } from '@/hooks/use-notebook'

/** RichText has no heading syntax; a `## Title` line becomes a bold line so sections still read as sections. */
function headingsToBold(md: string): string {
  return md.replace(/^#{1,6}\s+(.+)$/gm, '**$1**')
}

function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-muted text-[13px] tracking-[0.06em] uppercase">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

function PageRow({
  page,
  expanded,
  onToggle,
}: {
  page: NotebookPage
  expanded: boolean
  onToggle: () => void
}) {
  const isRead = page.status === 'read'
  return (
    <li className="border-b border-white/6 last:border-b-0">
      <button
        type="button"
        onClick={isRead ? onToggle : undefined}
        aria-expanded={isRead ? expanded : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left ${
          isRead ? 'cursor-pointer transition-colors hover:bg-white/[0.04]' : 'cursor-default'
        }`}
      >
        <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-black/40">
          {page.previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={page.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="text-muted flex h-full items-center justify-center">
              <NotebookIcon className="size-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-fg truncate text-[16px]" title={page.imageName}>
            {page.imageName || `Page ${page.position}`}
          </p>
          <p className="text-muted text-[13.5px]">Page {page.position}</p>
        </div>
        <p className="shrink-0 text-[13.5px] tabular-nums">
          {page.status === 'queued' && <span className="text-muted">Queued</span>}
          {page.status === 'reading' && (
            <span className="shimmer-text text-[#ffc627]">Reading…</span>
          )}
          {page.status === 'read' && (
            <span className="text-muted">{(page.ms / 1000).toFixed(1)}s</span>
          )}
          {page.status === 'failed' && (
            <span title={page.error} className="text-red-400">
              Could not read
            </span>
          )}
        </p>
      </button>
      {expanded && (
        <div className="text-fg relative mx-2 mb-3 rounded-2xl border border-white/8 bg-black/30 p-4 text-[16px] leading-[1.55] whitespace-pre-wrap">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close"
            className="text-muted hover:text-fg absolute top-3 right-3 transition-colors"
          >
            <Close className="size-4" />
          </button>
          <p className="text-muted text-[13.5px]">As read on ASU AIR</p>
          <p className="mt-2">{page.reading}</p>
        </div>
      )}
    </li>
  )
}

export function NotebookView({
  id,
  onRenamed,
  onDeleted,
}: {
  id: string
  onRenamed?: (name: string) => void
  /** Called after a successful delete so the shell can leave the now-missing notebook. */
  onDeleted?: () => void
}) {
  const nb = useNotebook(id)
  const sticky = useStickyNotes(id)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** The digest is long by design; it opens on demand so pages and chat stay in view. */
  const [digestOpen, setDigestOpen] = useState(false)
  /** The sticky board is out of the way until asked for: a rail on wide screens, a bottom sheet on phones. */
  const [notesOpen, setNotesOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** The notebook's own scroll column; nudges and new answers glide it to the thread. */
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const n = nb.pages.length
  const total = n + nb.queued.length
  const full = total >= nb.cap
  const hasRead = nb.pages.some((p) => p.status === 'read')

  useEffect(() => {
    if (nb.turns.length === 0) return
    // Every new turn (question or answer) glides the column to the thread end.
    const el = scrollRef.current
    if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }))
    if (!nb.asking) inputRef.current?.focus()
  }, [nb.asking, nb.turns.length])

  useEffect(() => {
    if (!notesOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotesOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notesOpen])

  // The server names a "New notebook" from its first digest; tell the shell so
  // the nav updates. The callback lives in a ref: the shell passes a fresh
  // arrow every render, and keying the effect on it made every nav refresh
  // re-fire the rename, which refreshed the nav again — an infinite GET loop.
  const onRenamedRef = useRef(onRenamed)
  useEffect(() => {
    onRenamedRef.current = onRenamed
  })
  useEffect(() => {
    if (nb.renamedTo) onRenamedRef.current?.(nb.renamedTo)
  }, [nb.renamedTo])

  async function confirmRemove() {
    setDeleting(true)
    setDeleteError(null)
    const ok = await nb.remove()
    setDeleting(false)
    if (!ok) {
      setDeleteError('Could not delete this notebook. Try again.')
      return
    }
    setConfirmDelete(false)
    onDeleted?.()
  }

  /** A nudged note becomes the student's next chat turn, framed the way they asked, and is struck through. */
  function scrollToThread() {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }))
  }

  function nudge(note: StickyNote) {
    if (!hasRead || nb.asking) return
    void nb.ask(`${NUDGE_PREFIX}\n\n${note.text}`, { source: 'sticky', display: note.text })
    sticky.markDone(note.id)
    // The note lands in the thread far below the board; take the student there.
    scrollToThread()
  }

  function submit() {
    const q = draft.trim()
    if (!q) return
    void nb.ask(q)
    setDraft('')
  }

  if (nb.loading) {
    return (
      <div className="thin-scroll relative z-10 flex w-full flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[820px] px-5 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3a1723] text-[#ffc627]">
              <NotebookIcon className="size-[22px]" />
            </span>
            <span className="shimmer-text text-[20px] font-medium tracking-[-0.02em] text-white">
              Opening notebook…
            </span>
          </div>
        </div>
      </div>
    )
  }

  const openNotes = sticky.notes.filter((n) => !n.done).length
  const notesProps = {
    notes: sticky.notes,
    canNudge: hasRead && !nb.asking,
    onAdd: sticky.add,
    onNudge: nudge,
    onRemove: sticky.remove,
  }

  return (
    <div className="relative z-10 flex min-h-0 w-full flex-1 flex-row">
      <div
        ref={scrollRef}
        className="thin-scroll relative flex min-w-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-[820px] px-5 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3a1723] text-[#ffc627]">
              <NotebookIcon className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={nameDraft ?? nb.notebook?.name ?? ''}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  const next = (nameDraft ?? '').trim()
                  setNameDraft(null)
                  if (next && next !== nb.notebook?.name) {
                    void nb.rename(next).then((ok) => {
                      if (ok) onRenamed?.(next)
                    })
                  }
                }}
                onKeyDown={(e) => {
                  // Enter commits through onBlur so the rename runs exactly once.
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    setNameDraft(null)
                    e.currentTarget.blur()
                  }
                }}
                aria-label="Notebook name"
                className="w-full truncate bg-transparent text-[22px] font-medium tracking-[-0.02em] text-white outline-none"
              />
              <p className="text-muted text-[15px]">
                Notebook · {n} {n === 1 ? 'page' : 'pages'}
                {nb.ingesting && nb.progress?.current && (
                  <span className="text-[#ffc627]"> · reading page {nb.progress.current}</span>
                )}
                {nb.queued.length > 0 && ` · ${nb.queued.length} queued`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={nb.ingesting}
              aria-label="Delete notebook"
              title="Delete notebook"
              className="text-muted hover:text-fg flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/5 disabled:opacity-40"
            >
              <TrashIcon className="size-[18px]" />
            </button>
          </div>
          {deleteError && <p className="mt-3 text-[15px] text-red-400">{deleteError}</p>}
          {nb.error && <p className="mt-3 text-[15px] text-red-400">{nb.error}</p>}

          <Section
            title="Pages"
            right={
              <button
                type="button"
                disabled={full}
                title={full ? `This notebook holds at most ${nb.cap} pages` : undefined}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full border border-white/12 px-4 py-2 text-[15px] transition-colors hover:bg-white/5 disabled:opacity-40"
              >
                <Plus className="size-3.5" />
                Add pages
                <span className="text-muted tabular-nums">
                  {total}/{nb.cap}
                </span>
              </button>
            }
          >
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const files = Array.from(e.dataTransfer.files).filter((f) =>
                  f.type.startsWith('image/'),
                )
                void nb.addPages(files)
              }}
              className={`mt-3 rounded-3xl border border-dashed p-4 transition-colors ${dragging ? 'border-[#ffc627]/60 bg-[#ffc627]/5' : 'border-white/12'}`}
            >
              {total === 0 && !nb.ingesting ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <PhotoStack className="size-8 text-muted" />
                  <p className="text-muted text-center text-[16px]">
                    Drop photos of your notebook pages here, as many as you like. Sol reads them one
                    at a time and builds one understanding of the whole set.
                  </p>
                </div>
              ) : (
                <ul className="thin-scroll -mx-1 flex max-h-[296px] flex-col overflow-y-auto px-1">
                  {nb.pages.map((p) => (
                    <PageRow
                      key={p.position}
                      page={p}
                      expanded={expanded === p.position}
                      onToggle={() => setExpanded(expanded === p.position ? null : p.position)}
                    />
                  ))}
                  {nb.queued.map((q, i) => (
                    <PageRow
                      key={`queued-${n + i + 1}`}
                      page={{
                        position: n + i + 1,
                        imageName: q.imageName,
                        reading: '',
                        status: 'queued',
                        model: '',
                        ms: 0,
                        previewUrl: q.previewUrl,
                      }}
                      expanded={false}
                      onToggle={() => {}}
                    />
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section
            title="Understanding"
            right={
              nb.notebook?.digestModel ? (
                <span className="text-muted text-[13.5px]">
                  rewritten by {nb.notebook.digestModel} on ASU AIR
                </span>
              ) : undefined
            }
          >
            {nb.notebook?.digest ? (
              <div className="relative mt-3 rounded-3xl border border-white/8 bg-white/[0.02]">
                <div
                  className={`text-fg thin-scroll px-5 py-4 text-[17px] leading-[1.55] ${
                    digestOpen ? 'max-h-[70vh] overflow-y-auto' : 'max-h-[420px] overflow-hidden'
                  }`}
                >
                  <RichText text={headingsToBold(nb.notebook.digest)} />
                </div>
                {/* Collapsed: a blurred fade over the cut-off so the text visibly
                    continues, with the toggle sitting on it. Open: the toggle
                    stays pinned at the bottom of the scroller. */}
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center rounded-b-3xl pb-3 ${
                    digestOpen
                      ? 'h-14'
                      : 'h-24 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/85 to-transparent backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black_55%,transparent)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setDigestOpen((v) => !v)}
                    aria-expanded={digestOpen}
                    className="text-fg pointer-events-auto rounded-full border border-white/12 bg-[#141415]/90 px-3.5 py-1.5 text-[13.5px] backdrop-blur transition-colors hover:bg-white/10"
                  >
                    {digestOpen ? 'Show less' : 'Show more'}
                  </button>
                </div>
              </div>
            ) : nb.ingesting ? (
              <p className="shimmer-text mt-3 text-[17px]">
                Building an understanding of the pages…
              </p>
            ) : (
              <p className="text-muted mt-3 text-[16px]">Nothing read yet. Add pages above.</p>
            )}
          </Section>

          {hasRead && (
            <Section title="Ask this notebook">
              <div className="mt-3 flex flex-col gap-7">
                {nb.turns.map((t) =>
                  t.role === 'user' ? (
                    <div key={t.id} className="flex flex-col items-end gap-1.5">
                      {t.source === 'sticky' && (
                        <span className="flex items-center gap-1.5 pr-2 text-[12.5px] tracking-[0.02em] text-[#ffc627]/90">
                          <span aria-hidden className="size-1.5 rounded-full bg-[#ffc627]" />
                          From your sticky notes · asked Sol to help answer
                        </span>
                      )}
                      <p
                        className={`text-fg max-w-[85%] rounded-3xl px-5 py-3.5 text-[17px] leading-[1.4] tracking-[-0.01em] whitespace-pre-wrap ${
                          t.source === 'sticky'
                            ? 'border border-[#ffc627]/25 bg-[#ffc627]/[0.07]'
                            : 'bg-surface-2'
                        }`}
                      >
                        {t.display ?? t.content}
                      </p>
                    </div>
                  ) : (
                    <div key={t.id}>
                      <div className="text-fg text-[17px] leading-[1.55] tracking-[-0.01em]">
                        <RichText text={t.content} />
                      </div>
                      {t.meta && (
                        <p className="text-muted mt-4 text-[12.5px]">
                          Answered by <span className="text-fg/80">{t.meta.model}</span> on ASU AIR
                          in {(t.meta.ms / 1000).toFixed(1)}s
                          {t.meta.searched && ' · searched the web'}
                        </p>
                      )}
                    </div>
                  ),
                )}
                {nb.asking && <p className="shimmer-text text-[17px] font-medium">Thinking…</p>}
                {nb.turns.length === 0 && !nb.asking && (
                  <div className="no-scroll -mx-4 flex gap-2 overflow-x-auto px-4">
                    {[
                      'Summarise what these pages cover',
                      'What terms are defined here?',
                      'What is still unclear or unfinished?',
                    ].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void nb.ask(s)}
                        className="text-fg shrink-0 rounded-full border border-[#3c4043] px-4 py-2 text-[15px] whitespace-nowrap transition-colors hover:bg-[#1f1f1f] active:scale-95"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>

        <div className="mx-auto mt-auto w-full max-w-[820px] shrink-0 px-4 pb-5">
          {hasRead ? (
            <Composer value={draft} onChange={setDraft} onSubmit={submit} inputRef={inputRef} />
          ) : (
            <div className="flex items-center gap-3 rounded-full border border-dashed border-white/12 px-5 py-3.5">
              <span className="text-muted text-[17px]">
                Add pages first, then ask anything about them
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Far-right rail: the sticky board. Wide screens only; it folds into the column below xl. */}
      {/* Sticky board. Collapsed: one small button at the right edge with the
          open-note count. Open on wide screens: a floating popover pinned to
          the right edge with its own scroll, nothing else moves. Open on
          phones: a bottom sheet over the page. Escape closes either. */}
      {!notesOpen && (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          aria-label="Open sticky notes"
          title="Sticky notes"
          className="absolute right-4 bottom-24 z-20 flex size-11 items-center justify-center rounded-full border border-[#ffc627]/30 bg-[#141415]/90 text-[#ffc627] shadow-lg backdrop-blur transition-colors hover:bg-[#ffc627]/10 xl:right-5 xl:bottom-6"
        >
          <StickyIcon className="size-5" />
          {openNotes > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ffc627] px-1 text-[11px] font-medium text-black tabular-nums">
              {openNotes}
            </span>
          )}
        </button>
      )}

      {notesOpen && (
        <div
          role="dialog"
          aria-label="Sticky notes"
          className="animate-rise absolute right-5 bottom-6 z-30 hidden max-h-[min(520px,70vh)] w-[320px] flex-col rounded-3xl border border-white/10 bg-[#141415]/95 p-4 shadow-2xl backdrop-blur xl:flex"
        >
          <StickyNotes {...notesProps} onClose={() => setNotesOpen(false)} />
        </div>
      )}

      {notesOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            aria-label="Close sticky notes"
            onClick={() => setNotesOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sticky notes"
            className="animate-rise absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col rounded-t-3xl border-t border-white/10 bg-[#141415] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <StickyNotes {...notesProps} onClose={() => setNotesOpen(false)} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this notebook?"
        body={`${nb.notebook?.name ?? 'This notebook'} and its ${n} ${n === 1 ? 'page' : 'pages'} go away, along with the understanding built from them. Your chats are not affected.`}
        confirmLabel="Delete notebook"
        busy={deleting}
        onConfirm={() => void confirmRemove()}
        onCancel={() => {
          if (!deleting) setConfirmDelete(false)
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          void nb.addPages(files)
        }}
      />
    </div>
  )
}
