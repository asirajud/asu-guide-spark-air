'use client'

import Image from 'next/image'

import { useEffect, useMemo, useState } from 'react'
import type { ChatSummary } from '@/lib/chats'
import {
  Close,
  ComposePencil,
  Dots,
  PinIcon,
  RenameIcon,
  BriefIcon,
  NotebookIcon,
  SearchIcon,
  TrashIcon,
} from '@/components/icons'
import { RenameRow } from '@/components/rename-row'
import { NOTEBOOKS } from '@/components/notebook-preview'
import { TypedTitle } from '@/components/typed-title'

/** Left drawer: new chat, search, and the saved conversation list. */
export function SideNav({
  open,
  chats,
  activeId,
  onClose,
  onNewChat,
  onSelect,
  onRename,
  onTogglePin,
  onDelete,
  onOpenPreview,
  openPreview = null,
  justTitled = null,
  onTitleTyped,
  asurite = null,
  railOpen = true,
}: {
  open: boolean
  chats: ChatSummary[]
  activeId: string | null
  onClose: () => void
  onNewChat: () => void
  onSelect: (id: string) => void
  /** Returns false when the rename failed, so the row can revert and say so. */
  onRename: (id: string, title: string) => void | boolean | Promise<void | boolean>
  onTogglePin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
  /** Opens a preview of an unbuilt feature; null returns to the chat. */
  onOpenPreview: (id: string | null) => void
  /** Which preview is showing: 'brief', a notebook id, or null. */
  openPreview?: string | null
  /** Chat whose AIR-generated title should type itself out, once. */
  justTitled?: string | null
  /** Clears that flag so a later refresh does not replay the animation. */
  onTitleTyped: () => void
  /** ASURITE of the signed-in user, or null. */
  asurite?: string | null
  /** Desktop only: whether the permanent rail is expanded. */
  railOpen?: boolean
}) {
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  /** Shown immediately on save; the list itself only catches up after refresh. */
  const [pending, setPending] = useState<{ id: string; title: string } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setMenuFor(null)
      setRenaming(null)
      setQuery('')
    }
  }, [open])

  // The optimistic title is only a stand-in until the real list carries it.
  useEffect(() => {
    if (pending && chats.some((c) => c.id === pending.id && c.title === pending.title))
      setPending(null)
  }, [chats, pending])

  async function saveName(id: string, title: string) {
    setRenaming(null)
    setFailed(null)
    setPending({ id, title })
    const ok = await onRename(id, title)
    if (ok === false) {
      setPending(null)
      setFailed(id)
      setTimeout(() => setFailed((f) => (f === id ? null : f)), 4000)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && !renaming && (menuFor ? setMenuFor(null) : onClose())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuFor, renaming, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats
  }, [chats, query])

  const pinned = filtered.filter((c) => c.pinned)
  const recents = filtered.filter((c) => !c.pinned)

  return (
    <div
      // A closed drawer must leave the accessibility tree, or a keyboard user
      // tabs into an invisible off-canvas menu.
      inert={!open && !railOpen ? true : undefined}
      className={`absolute inset-0 z-40 lg:relative lg:inset-auto lg:z-0 lg:h-full lg:shrink-0 lg:pointer-events-auto ${
        open ? '' : 'pointer-events-none lg:pointer-events-auto'
      }`}
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        tabIndex={open ? 0 : -1}
      />

      <aside
        className={`absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col rounded-r-3xl bg-[#1b1b1b] transition-transform duration-250 ease-out lg:static lg:h-full lg:max-w-none lg:translate-x-0 lg:overflow-hidden lg:rounded-none lg:border-white/8 lg:transition-[width] lg:duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${railOpen ? 'lg:w-[300px] lg:border-r' : 'lg:w-0 lg:border-r-0'}`}
      >
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Image src="/mark-brain.png" alt="" width={26} height={26} className="size-[26px]" />
          <span className="flex-1 text-[21px] font-medium tracking-[-0.02em] text-white">Sol</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-fg rounded-full p-2 transition-colors hover:bg-white/5 lg:hidden"
          >
            <Close className="size-[21px]" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onNewChat}
            className="text-fg flex w-full items-center gap-4 rounded-full bg-[#282828] px-4 py-3.5 text-left text-[15.5px] transition-colors hover:bg-[#303030] active:scale-[0.99]"
          >
            <ComposePencil className="size-[21px]" />
            New chat
          </button>

          <div className="mt-1 flex items-center gap-4 rounded-full px-4 py-3">
            <SearchIcon className="text-fg size-[21px] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="text-fg placeholder:text-fg min-w-0 flex-1 bg-transparent text-[15.5px] outline-none"
            />
          </div>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto px-3 pb-4">
          {chats.length === 0 && (
            <p className="text-muted px-4 py-6 text-[13.5px] leading-relaxed">
              No saved chats yet. Ask something and it&apos;ll show up here — titled by an AIR
              model.
            </p>
          )}

          {/* Neither of these is wired to anything — previews of where Sol is
              going. See docs/ROADMAP.md. */}
          <button
            type="button"
            onClick={() => onOpenPreview('brief')}
            className={`mt-3 flex w-full items-center gap-3 rounded-full py-2.5 pr-3 pl-4 text-left transition-colors ${
              openPreview === 'brief' ? 'bg-[#3a1723]' : 'hover:bg-white/5'
            }`}
          >
            <BriefIcon
              className={`size-[17px] shrink-0 ${
                openPreview === 'brief' ? 'text-[#ffc627]' : 'text-muted'
              }`}
            />
            <span
              className={`min-w-0 flex-1 truncate text-[14.5px] ${
                openPreview === 'brief' ? 'font-medium text-white' : 'text-fg'
              }`}
            >
              Daily brief
            </span>
            <span className="text-muted shrink-0 rounded-full border border-white/12 px-2 py-0.5 text-[10.5px] tracking-[0.04em] uppercase">
              Soon
            </span>
          </button>

          <Section label="Notebooks">
            {NOTEBOOKS.map((n) => {
              const open = n.id === openPreview
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onOpenPreview(n.id)}
                  className={`flex w-full items-center gap-3 rounded-full py-2.5 pr-3 pl-4 text-left transition-colors ${
                    open ? 'bg-[#3a1723]' : 'hover:bg-white/5'
                  }`}
                >
                  <NotebookIcon
                    className={`size-[17px] shrink-0 ${open ? 'text-[#ffc627]' : 'text-muted'}`}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-[14.5px] ${
                      open ? 'font-medium text-white' : 'text-fg'
                    }`}
                  >
                    {n.name}
                  </span>
                  <span className="text-muted shrink-0 rounded-full border border-white/12 px-2 py-0.5 text-[10.5px] tracking-[0.04em] uppercase">
                    Soon
                  </span>
                </button>
              )
            })}
          </Section>

          {pinned.length > 0 && (
            <Section label="Pinned">
              {pinned.map((c) => (
                <Row key={c.id} chat={c} />
              ))}
            </Section>
          )}

          {recents.length > 0 && (
            <Section label="Recents">
              {recents.map((c) => (
                <Row key={c.id} chat={c} />
              ))}
            </Section>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/8 px-5 py-4">
          <div className="size-9 shrink-0 rounded-full bg-[linear-gradient(140deg,#8c1d40,#c2436a_45%,#ffc627)] p-[2px]">
            <div className="flex size-full items-center justify-center rounded-full bg-[#1b1b1b] text-[12px] font-medium text-white uppercase">
              {asurite ? asurite.slice(0, 2) : '—'}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] text-white">{asurite ?? 'Not signed in'}</p>
            <p className="text-muted text-[12px]">Demo · ASU AIR</p>
          </div>

          {asurite ? (
            <a
              href="/api/auth/logout"
              className="text-muted hover:text-fg shrink-0 rounded-full px-3 py-2 text-[13.5px] transition-colors hover:bg-white/5"
            >
              Sign out
            </a>
          ) : (
            <a
              href="/api/auth/login"
              className="bg-asu-maroon shrink-0 rounded-full px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-[#a52350]"
            >
              Sign in
            </a>
          )}
        </div>
      </aside>
    </div>
  )

  function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="mt-3">
        <p className="text-muted px-4 pb-1 text-[13px]">{label}</p>
        {children}
      </div>
    )
  }

  function Row({ chat }: { chat: ChatSummary }) {
    return (
      <ChatRow
        chat={chat}
        active={chat.id === activeId}
        renaming={renaming === chat.id}
        menuOpen={menuFor === chat.id}
        pendingTitle={pending?.id === chat.id ? pending.title : null}
        failed={failed === chat.id}
        typeTitle={justTitled === chat.id}
        onSelect={onSelect}
        onStartRename={setRenaming}
        onCancelRename={() => setRenaming(null)}
        onSave={saveName}
        onToggleMenu={(id) => setMenuFor(menuFor === id ? null : id)}
        onCloseMenu={() => setMenuFor(null)}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
        onTyped={onTitleTyped}
      />
    )
  }
}

/**
 * Declared at module scope on purpose. Nested inside SideNav it got a fresh
 * component identity on every render, so the whole row remounted whenever the
 * chat list refreshed — restarting the title animation mid-type and tearing
 * the rename input out from under the cursor.
 */
function ChatRow({
  chat,
  active,
  renaming,
  menuOpen,
  pendingTitle,
  failed,
  typeTitle,
  onSelect,
  onStartRename,
  onCancelRename,
  onSave,
  onToggleMenu,
  onCloseMenu,
  onTogglePin,
  onDelete,
  onTyped,
}: {
  chat: ChatSummary
  active: boolean
  renaming: boolean
  menuOpen: boolean
  /** Optimistic title, shown until the real list catches up. */
  pendingTitle: string | null
  failed: boolean
  typeTitle: boolean
  onSelect: (id: string) => void
  onStartRename: (id: string) => void
  onCancelRename: () => void
  onSave: (id: string, title: string) => void | Promise<void>
  onToggleMenu: (id: string) => void
  onCloseMenu: () => void
  onTogglePin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
  onTyped: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const title = pendingTitle ?? chat.title

  if (renaming)
    return (
      <div className="relative">
        <RenameRow
          initial={chat.title}
          onSave={(next) => onSave(chat.id, next)}
          onCancel={onCancelRename}
        />
      </div>
    )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(chat.id)}
        onDoubleClick={() => onStartRename(chat.id)}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault()
            onStartRename(chat.id)
          }
        }}
        className={`flex w-full items-center gap-2 rounded-full py-2.5 pr-10 pl-4 text-left transition-colors ${
          active ? 'bg-[#3a1723]' : 'hover:bg-white/5'
        }`}
      >
        <span className={`truncate text-[14.5px] ${active ? 'font-medium text-white' : 'text-fg'}`}>
          {typeTitle ? <TypedTitle text={title} onDone={onTyped} /> : title}
        </span>
      </button>

      <button
        type="button"
        aria-label={`Options for ${title}`}
        onClick={() => onToggleMenu(chat.id)}
        className="text-muted hover:text-fg absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 transition-colors"
      >
        <Dots className="size-[17px]" />
      </button>

      {failed && (
        <p role="status" className="px-4 pt-1 pb-0.5 text-[12.5px] text-[#ff8f8f]">
          Could not rename that conversation.
        </p>
      )}

      {menuOpen && (
        <div className="animate-sheet-in absolute top-9 right-2 z-10 w-[190px] overflow-hidden rounded-2xl bg-[#2b2b2b] py-1.5 shadow-xl shadow-black/60">
          <MenuItem
            icon={<PinIcon className="size-[18px]" />}
            label={chat.pinned ? 'Unpin' : 'Pin'}
            onClick={() => {
              onTogglePin(chat.id, !chat.pinned)
              onCloseMenu()
            }}
          />
          <MenuItem
            icon={<RenameIcon className="size-[18px]" />}
            label="Rename"
            onClick={() => {
              onCloseMenu()
              onStartRename(chat.id)
            }}
          />
          {/* Deleting is irreversible, so it asks in place rather than through
              a native confirm() the dark UI cannot style. */}
          {confirmDelete ? (
            <div className="flex items-center gap-2 px-4 py-2.5 text-[14.5px]">
              <span className="text-fg flex-1">Delete?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete(chat.id)
                  setConfirmDelete(false)
                  onCloseMenu()
                }}
                className="rounded-full px-2 py-0.5 text-[#ff8f8f] transition-colors hover:bg-white/6"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-muted hover:text-fg rounded-full px-2 py-0.5 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <MenuItem
              icon={<TrashIcon className="size-[18px]" />}
              label="Delete"
              destructive
              onClick={() => setConfirmDelete(true)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14.5px] transition-colors hover:bg-white/6 ${
        destructive ? 'text-[#f28b82]' : 'text-fg'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
