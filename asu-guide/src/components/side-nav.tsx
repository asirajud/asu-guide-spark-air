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
  SearchIcon,
  TrashIcon,
} from '@/components/icons'

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
  asurite = null,
  railOpen = true,
}: {
  open: boolean
  chats: ChatSummary[]
  activeId: string | null
  onClose: () => void
  onNewChat: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
  /** ASURITE of the signed-in user, or null. */
  asurite?: string | null
  /** Desktop only: whether the permanent rail is expanded. */
  railOpen?: boolean
}) {
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setMenuFor(null)
      setQuery('')
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && (menuFor ? setMenuFor(null) : onClose())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuFor, onClose])

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
    const active = chat.id === activeId
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => onSelect(chat.id)}
          className={`flex w-full items-center gap-2 rounded-full py-2.5 pr-10 pl-4 text-left transition-colors ${
            active ? 'bg-[#3a1723]' : 'hover:bg-white/5'
          }`}
        >
          <span
            className={`truncate text-[14.5px] ${active ? 'font-medium text-white' : 'text-fg'}`}
          >
            {chat.title}
          </span>
        </button>

        <button
          type="button"
          aria-label={`Options for ${chat.title}`}
          onClick={() => setMenuFor(menuFor === chat.id ? null : chat.id)}
          className="text-muted hover:text-fg absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 transition-colors"
        >
          <Dots className="size-[17px]" />
        </button>

        {menuFor === chat.id && (
          <div className="animate-sheet-in absolute top-9 right-2 z-10 w-[190px] overflow-hidden rounded-2xl bg-[#2b2b2b] py-1.5 shadow-xl shadow-black/60">
            <MenuItem
              icon={<PinIcon className="size-[18px]" />}
              label={chat.pinned ? 'Unpin' : 'Pin'}
              onClick={() => {
                onTogglePin(chat.id, !chat.pinned)
                setMenuFor(null)
              }}
            />
            <MenuItem
              icon={<RenameIcon className="size-[18px]" />}
              label="Rename"
              onClick={() => {
                const next = window.prompt('Rename chat', chat.title)
                if (next?.trim()) onRename(chat.id, next.trim())
                setMenuFor(null)
              }}
            />
            <MenuItem
              icon={<TrashIcon className="size-[18px]" />}
              label="Delete"
              destructive
              onClick={() => {
                onDelete(chat.id)
                setMenuFor(null)
              }}
            />
          </div>
        )}
      </div>
    )
  }
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
