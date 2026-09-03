'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Chat } from '@/components/chat'
import { Header } from '@/components/header'
import { SideNav } from '@/components/side-nav'
import type { ChatSummary } from '@/lib/chats'
import type { DemoEvent } from '@/lib/events'
import type { Turn } from '@/components/chat'

/** One finished turn, as reported by Chat. */
export type PersistTurn = {
  role: 'user' | 'assistant'
  content: string
  kind: string
  imageName?: string | null
}

/** Owns conversation persistence; Chat stays focused on the conversation itself. */
/**
 * Sidebar state survives a reload: which conversation was open, and whether the
 * desktop rail was collapsed. Keyed per ASURITE so one account's selection is
 * never restored into another's session, and read defensively — private windows
 * and blocked site data both make localStorage throw rather than return null.
 */
/**
 * The rail's state lives in a cookie, not localStorage: the server has to know
 * it to render the first paint correctly. Reading it on the client after mount
 * means the rail renders open and then snaps shut, which is visible on reload.
 */
const RAIL_COOKIE = 'asu-guide-rail'
const activeKey = (asurite: string | null) => `asu-guide:active-chat:${asurite ?? 'anon'}`

function writeRailCookie(open: boolean) {
  try {
    document.cookie = `${RAIL_COOKIE}=${open ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  } catch {
    /* cookies unavailable — the rail simply won't be remembered */
  }
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — the app still works, it just forgets */
  }
}

export function AppShell({
  events,
  asurite,
  railInitiallyOpen = true,
}: {
  events: DemoEvent[]
  asurite: string | null
  /** Read from a cookie on the server so the first paint matches. */
  railInitiallyOpen?: boolean
}) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  /** Desktop rail: shown by default, collapsible from the same hamburger. */
  const [railOpen, setRailOpen] = useState(railInitiallyOpen)
  const [sessionKey, setSessionKey] = useState(0)
  const [restoredTurns, setRestoredTurns] = useState<Turn[] | null>(null)

  /**
   * The conversation row is created lazily on the first turn. Turns arrive about
   * a second apart, so the id is held as a promise: the assistant's turn awaits
   * the same creation the user's turn kicked off instead of racing it into a
   * second conversation.
   */
  const chatIdRef = useRef<Promise<string | null> | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/chats')
    if (res.ok) setChats(((await res.json()) as { chats: ChatSummary[] }).chats)
  }, [])

  // Load the saved conversation list once, then reopen whatever was last open.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/chats')
      if (cancelled || !res.ok) return

      const list = ((await res.json()) as { chats: ChatSummary[] }).chats
      if (cancelled) return
      setChats(list)

      // Only restore a conversation that still exists and still belongs here.
      const last = readStored(activeKey(asurite))
      if (last && list.some((c) => c.id === last)) {
        void select(last)
      } else if (last) {
        writeStored(activeKey(asurite), null)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asurite])

  function newChat() {
    chatIdRef.current = null
    writeStored(activeKey(asurite), null)
    setActiveId(null)
    setRestoredTurns(null)
    setSessionKey((k) => k + 1)
    setNavOpen(false)
  }

  const persist = useCallback(
    async (t: PersistTurn) => {
      if (!chatIdRef.current) {
        // First turn of a fresh session: name it with an AIR model, then create it.
        chatIdRef.current = (async () => {
          let title = t.content
          try {
            const res = await fetch('/api/title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: t.content }),
            })
            if (res.ok) title = ((await res.json()) as { title: string }).title
          } catch {
            /* keep the raw prompt as the title */
          }
          const created = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })
          if (!created.ok) {
            // A failed create (expired session, server error) must not be
            // cached as a resolved id — every later PATCH would go to
            // /api/chats/undefined and the whole conversation would be lost
            // silently.
            chatIdRef.current = null
            return null
          }
          const { id } = (await created.json()) as { id?: string }
          if (!id) {
            chatIdRef.current = null
            return null
          }
          writeStored(activeKey(asurite), id)
          setActiveId(id)
          return id
        })()
      }

      const id = await chatIdRef.current
      if (!id) return // the conversation could not be created; nothing to append to
      await fetch(`/api/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          append: {
            role: t.role,
            content: t.content,
            kind: t.kind,
            imageName: t.imageName ?? null,
          },
        }),
      })
      void refresh()
    },
    [refresh, asurite],
  )

  async function select(id: string) {
    const res = await fetch(`/api/chats/${id}`)
    setNavOpen(false)
    if (!res.ok) {
      writeStored(activeKey(asurite), null)
      return
    }
    writeStored(activeKey(asurite), id)

    const data = (await res.json()) as {
      messages: { id: string; role: 'user' | 'assistant'; content: string; kind: string }[]
    }

    chatIdRef.current = Promise.resolve(id)
    setActiveId(id)
    setSessionKey((k) => k + 1)
    setRestoredTurns(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        kind: (m.kind === 'vision' ? 'vision' : m.kind === 'events' ? 'events' : 'text') as Turn['kind'],
        restored: true,
        // Object URLs die with the page, and cited cards are not stored, so a
        // reloaded thread comes back as text. The model still sees every word of it.
        mediaUrl: null,
        events: [],
      })),
    )
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/chats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    void refresh()
  }

  async function remove(id: string) {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' })
    // Never leave a deleted conversation as the remembered one.
    if (readStored(activeKey(asurite)) === id) writeStored(activeKey(asurite), null)
    if (id === activeId) newChat()
    void refresh()
  }

  return (
    <>
      {asurite && (
      <SideNav
        open={navOpen}
        chats={chats}
        activeId={activeId}
        onClose={() => setNavOpen(false)}
        onNewChat={newChat}
        onSelect={select}
        onRename={(id, title) => patch(id, { title })}
        onTogglePin={(id, pinned) => patch(id, { pinned })}
        onDelete={remove}
        asurite={asurite}
        railOpen={railOpen}
      />
      )}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Header
          onMenu={
            asurite
              ? () => {
                  setNavOpen((v) => !v)
                  setRailOpen((v) => {
                    writeRailCookie(!v)
                    return !v
                  })
                }
              : undefined
          }
          onNewChat={newChat}
          asurite={asurite}
        />
        {/* Full-width stage — the thread centres itself inside it, so the
            ambient glow spans the whole area instead of ending mid-screen. */}
        <div className="relative flex min-h-0 w-full flex-1 flex-col">
          <Chat
            key={sessionKey}
            events={events}
            asurite={asurite}
            onTurn={persist}
            restoredTurns={restoredTurns}
          />
        </div>
      </div>
    </>
  )
}