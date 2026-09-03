'use client'

import { useCallback, useEffect, useState } from 'react'
import { Chat } from '@/components/chat'
import { Header } from '@/components/header'
import { SideNav } from '@/components/side-nav'
import type { ChatSummary } from '@/lib/chats'
import type { DemoEvent } from '@/lib/events'

export type Exchange = {
  prompt: string
  reply: string
  kind: 'events' | 'vision'
  imageName?: string | null
}

/** Owns conversation persistence; Chat stays focused on the conversation itself. */
export function AppShell({ events, asurite }: { events: DemoEvent[]; asurite: string | null }) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  const [restored, setRestored] = useState<{ prompt: string; reply: string; kind: 'events' | 'vision' } | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/chats')
    if (res.ok) setChats(((await res.json()) as { chats: ChatSummary[] }).chats)
  }, [])

  // Load the saved conversation list once, on mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/chats')
      if (!cancelled && res.ok) {
        setChats(((await res.json()) as { chats: ChatSummary[] }).chats)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function newChat() {
    setActiveId(null)
    setRestored(null)
    setSessionKey((k) => k + 1)
    setNavOpen(false)
  }

  /** Called by Chat once a reply has fully rendered. */
  const persist = useCallback(
    async (ex: Exchange) => {
      if (activeId) {
        await fetch(`/api/chats/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ append: { role: 'user', content: ex.prompt, kind: ex.kind } }),
        })
        await fetch(`/api/chats/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ append: { role: 'assistant', content: ex.reply, kind: ex.kind } }),
        })
        void refresh()
        return
      }

      // First message in a session: let an AIR model name it.
      let title = ex.prompt
      try {
        const res = await fetch('/api/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: ex.prompt }),
        })
        if (res.ok) title = ((await res.json()) as { title: string }).title
      } catch {
        /* keep the raw prompt as the title */
      }

      const created = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt: ex.prompt, reply: ex.reply, kind: ex.kind, imageName: ex.imageName }),
      })
      if (created.ok) setActiveId(((await created.json()) as { id: string }).id)
      void refresh()
    },
    [activeId, refresh],
  )

  async function select(id: string) {
    const res = await fetch(`/api/chats/${id}`)
    setNavOpen(false)
    if (!res.ok) return

    const data = (await res.json()) as {
      messages: { role: 'user' | 'assistant'; content: string; kind: string }[]
    }
    const lastUser = [...data.messages].reverse().find((m) => m.role === 'user')
    const lastReply = [...data.messages].reverse().find((m) => m.role === 'assistant')

    setActiveId(id)
    setSessionKey((k) => k + 1)
    setRestored(
      lastUser && lastReply
        ? {
            prompt: lastUser.content,
            reply: lastReply.content,
            kind: (lastReply.kind === 'vision' ? 'vision' : 'events') as 'events' | 'vision',
          }
        : null,
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
    if (id === activeId) newChat()
    void refresh()
  }

  return (
    <>
      <Header onMenu={() => setNavOpen(true)} onNewChat={newChat} asurite={asurite} />
      <Chat
        key={sessionKey}
        events={events}
        asurite={asurite}
        onExchange={persist}
        restored={restored}
      />
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
      />
    </>
  )
}
