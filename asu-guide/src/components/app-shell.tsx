'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Chat } from '@/components/chat'
import { Header, type ChatMode } from '@/components/header'
import { SideNav, type NotebookNavItem } from '@/components/side-nav'
import { NotebookView } from '@/components/notebook-view'
import { DailyBriefPreview } from '@/components/daily-brief-preview'
import { HeatRouteDemo } from '@/components/heatroute-demo'
import { SHOW_HEATROUTE_PAGE } from '@/lib/heatroute-ui'
import type { ChatSummary } from '@/lib/chats'
import type { DemoEvent } from '@/lib/events'
import type { Turn } from '@/components/chat'
import type { HeatRoutePlan, WeatherReport } from '@/lib/tools'

/** One finished turn, as reported by Chat. */
export type PersistTurn = {
  role: 'user' | 'assistant'
  content: string
  kind: string
  imageName?: string | null
  payload?: { events?: DemoEvent[]; heatroute?: HeatRoutePlan; weather?: WeatherReport } | null
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

/**
 * Keep the address bar in step without a navigation: replaceState swaps the
 * path and nothing re-renders or refetches, so the back button is not spammed
 * with every chat switch either.
 */
function setUrl(path: string) {
  if (typeof window !== 'undefined' && window.location.pathname !== path) {
    window.history.replaceState(null, '', path)
  }
}

/** Cards and plans stored with a turn come back as JSON text; a bad row is just a turn without them. */
function parsePayload(
  raw: string | null | undefined,
): Pick<Turn, 'events' | 'heatroute' | 'weather'> {
  if (!raw) return {}
  try {
    const p = JSON.parse(raw) as {
      events?: DemoEvent[]
      heatroute?: HeatRoutePlan
      weather?: WeatherReport
    }
    return {
      ...(Array.isArray(p.events) && p.events.length ? { events: p.events } : {}),
      ...(p.heatroute && typeof p.heatroute === 'object' ? { heatroute: p.heatroute } : {}),
      ...(p.weather && typeof p.weather === 'object' ? { weather: p.weather } : {}),
    }
  } catch {
    return {}
  }
}

export function AppShell({
  events,
  asurite,
  railInitiallyOpen = true,
  notebooksEnabled = false,
  heatrouteEnabled = false,
  initialChat = null,
  initialNotebook = null,
  initialHeat = false,
}: {
  events: DemoEvent[]
  asurite: string | null
  /** Read from a cookie on the server so the first paint matches. */
  railInitiallyOpen?: boolean
  /** Admin switch from /s/admin. Off hides the section and skips the fetch. */
  notebooksEnabled?: boolean
  /** From the URL (`/c/<id>`, `/n/<id>`): what to open first instead of the remembered chat. */
  initialChat?: string | null
  initialNotebook?: string | null
  /** Admin feature switch for HeatRoute, and whether `/heat` was the URL. */
  heatrouteEnabled?: boolean
  initialHeat?: boolean
}) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  /** Desktop rail: shown by default, collapsible from the same hamburger. */
  const [railOpen, setRailOpen] = useState(railInitiallyOpen)
  const [sessionKey, setSessionKey] = useState(0)
  /**
   * Which unbuilt feature is being previewed instead of the chat: 'brief', or a
   * notebook id. Null is the normal chat.
   */
  const [preview, setPreview] = useState<string | null>(null)
  /** Chat just named by an AIR model, so the sidebar can type its title out. */
  const [justTitled, setJustTitled] = useState<string | null>(null)
  const [restoredTurns, setRestoredTurns] = useState<Turn[] | null>(null)
  const [notebooks, setNotebooks] = useState<NotebookNavItem[]>([])
  /** Fast, deep, or Council reasoning. Shown in the header and owned by the shell. */
  const [mode, setMode] = useState<ChatMode>('fast')
  /** Notebook open in the stage. Null means the chat (or a preview) is showing. */
  const [openNotebook, setOpenNotebook] = useState<string | null>(null)
  /** HeatRoute page open in the stage (`/heat`). */
  const [openHeat, setOpenHeat] = useState(initialHeat && heatrouteEnabled)

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

  const refreshNotebooks = useCallback(async () => {
    const res = await fetch('/api/notebooks')
    if (res.ok) setNotebooks(((await res.json()) as { notebooks: NotebookNavItem[] }).notebooks)
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

      // The URL wins over the remembered chat, so a shared or refreshed
      // /c/<id> opens that chat. Only restore a conversation that still exists
      // and still belongs here; a foreign id lands on an empty chat at `/`.
      if (initialHeat && !heatrouteEnabled) setUrl('/')
      if (initialHeat && heatrouteEnabled) {
        // /heat wins: restoring the remembered chat here would call select(),
        // which closes HeatRoute and rewrites the URL to /c/<id>.
      } else if (initialNotebook && notebooksEnabled) {
        openNotebookById(initialNotebook)
      } else if (initialChat && list.some((c) => c.id === initialChat)) {
        void select(initialChat)
      } else {
        if (initialChat || initialNotebook) setUrl('/')
        const last = readStored(activeKey(asurite))
        if (last && list.some((c) => c.id === last)) {
          void select(last)
        } else if (last) {
          writeStored(activeKey(asurite), null)
        }
      }

      // Refresh notebooks if asurite is non-null
      if (asurite && notebooksEnabled) void refreshNotebooks()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asurite])

  function newChat() {
    setUrl('/')
    setOpenHeat(false)
    setPreview(null)
    setOpenNotebook(null)
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
          setUrl(`/c/${id}`)
          // Only a title generated in this session animates; restores do not.
          setJustTitled(id)
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
            payload: t.payload ?? null,
          },
        }),
      })
      void refresh()
    },
    [refresh, asurite],
  )

  async function select(id: string) {
    const res = await fetch(`/api/chats/${id}`)
    setPreview(null)
    setOpenHeat(false)
    setOpenNotebook(null)
    setNavOpen(false)
    if (!res.ok) {
      writeStored(activeKey(asurite), null)
      return
    }
    writeStored(activeKey(asurite), id)

    const data = (await res.json()) as {
      messages: {
        id: string
        role: 'user' | 'assistant'
        content: string
        kind: string
        payload?: string | null
      }[]
    }

    chatIdRef.current = Promise.resolve(id)
    setActiveId(id)
    setUrl(`/c/${id}`)
    setSessionKey((k) => k + 1)
    setRestoredTurns(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        kind: (m.kind === 'vision' || m.kind === 'media'
          ? 'vision'
          : m.kind === 'events'
            ? 'events'
            : 'text') as Turn['kind'],
        // What a vision model read off an image: context for the chat model, not a reply.
        hidden: m.kind === 'media',
        ...parsePayload(m.payload),
        restored: true,
        // Object URLs die with the page, and cited cards are not stored, so a
        // reloaded thread comes back as text. The model still sees every word of it.
        mediaUrl: null,
        events: [],
      })),
    )
  }

  /** Reports whether the write landed so the caller can revert an optimistic UI. */
  async function patch(id: string, body: Record<string, unknown>) {
    let ok = false
    try {
      ok = (
        await fetch(`/api/chats/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).ok
    } catch {
      /* offline or the server went away — reported as a failed write */
    }
    void refresh()
    return ok
  }

  async function remove(id: string) {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' })
    // Never leave a deleted conversation as the remembered one.
    if (readStored(activeKey(asurite)) === id) writeStored(activeKey(asurite), null)
    if (id === activeId) newChat()
    void refresh()
  }

  async function newNotebook() {
    const res = await fetch('/api/notebooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New notebook' }),
    })
    if (!res.ok) return
    const { id } = (await res.json()) as { id: string }
    await refreshNotebooks()
    openNotebookById(id)
  }

  function openHeatRoute() {
    setPreview(null)
    setOpenNotebook(null)
    setOpenHeat(true)
    setNavOpen(false)
    setUrl('/heat')
  }

  function openNotebookById(id: string) {
    setPreview(null)
    setOpenHeat(false)
    setOpenNotebook(id)
    setUrl(`/n/${id}`)
    setNavOpen(false)
  }

  return (
    <>
      {asurite && (
        <SideNav
          open={navOpen}
          chats={chats}
          activeId={openNotebook || openHeat ? null : activeId}
          onClose={() => setNavOpen(false)}
          onNewChat={newChat}
          onSelect={select}
          onRename={(id, title) => patch(id, { title })}
          onTogglePin={(id, pinned) => patch(id, { pinned })}
          onDelete={remove}
          asurite={asurite}
          railOpen={railOpen}
          justTitled={justTitled}
          onTitleTyped={() => setJustTitled(null)}
          openPreview={preview}
          onOpenPreview={(id) => {
            setPreview(id)
            setOpenHeat(false)
            setUrl('/')
            setOpenNotebook(null)
            setNavOpen(false)
          }}
          notebooks={notebooks}
          notebooksEnabled={notebooksEnabled}
          heatrouteEnabled={heatrouteEnabled && SHOW_HEATROUTE_PAGE}
          openHeat={openHeat}
          onOpenHeatRoute={openHeatRoute}
          openNotebook={openNotebook}
          onOpenNotebook={openNotebookById}
          onNewNotebook={() => void newNotebook()}
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
          mode={mode}
          onModeChange={setMode}
        />
        {/* Full-width stage — the thread centres itself inside it, so the
            ambient glow spans the whole area instead of ending mid-screen. */}
        <div className="relative flex min-h-0 w-full flex-1 flex-col">
          {openHeat ? (
            <HeatRouteDemo />
          ) : preview === 'brief' ? (
            <DailyBriefPreview events={events} />
          ) : openNotebook ? (
            <NotebookView
              key={openNotebook}
              id={openNotebook}
              onRenamed={() => void refreshNotebooks()}
              onDeleted={() => {
                void refreshNotebooks()
                newChat()
              }}
            />
          ) : (
            <Chat
              key={sessionKey}
              events={events}
              asurite={asurite}
              onTurn={persist}
              restoredTurns={restoredTurns}
              mode={mode}
            />
          )}
        </div>
      </div>
    </>
  )
}
