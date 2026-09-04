'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Chevron, ComposePencil, CouncilIcon, Hamburger } from '@/components/icons'

export type ChatMode = 'fast' | 'deep' | 'council'

export const MODES: { id: ChatMode; label: string; model: string; hint: string }[] = [
  {
    id: 'fast',
    label: 'Fast',
    model: 'qwen35-27b',
    hint: 'Answers in a couple of seconds. The default.',
  },
  {
    id: 'deep',
    label: 'Deep thinking',
    model: 'gpt-oss-120b',
    hint: 'Slower, more careful. A reasoning model with its budget turned up.',
  },
  {
    id: 'council',
    label: 'Council',
    model: '4 agents + chair',
    hint: 'A lead answer is challenged by three AIR agents, then reconciled by a chair.',
  },
]

/** Mirrors the Gemini app bar: hamburger · "Sol AIR ⌄ •" · compose · avatar. */
export function Header({
  onMenu,
  onNewChat,
  asurite,
  mode = 'fast',
  onModeChange,
}: {
  onMenu?: () => void
  onNewChat?: () => void
  /** ASURITE of the signed-in user, or null when signed out. */
  asurite?: string | null
  /** Which model answers: shown in the title, picked from its dropdown. */
  mode?: ChatMode
  onModeChange?: (mode: ChatMode) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = MODES.find((m) => m.id === mode) ?? MODES[0]

  // Close on outside pointerdown (a click listener would fire after the
  // trigger's own onClick and reopen what it just closed) and on Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4">
      {onMenu && (
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={onMenu}
          className="bg-surface text-fg flex size-12 items-center justify-center rounded-full transition-colors hover:bg-[#2a2a2a] active:scale-95"
        >
          <Hamburger className="size-6" />
        </button>
      )}

      <div ref={menuRef} className="relative flex flex-1 items-center pl-1">
        <button
          type="button"
          onClick={() => onModeChange && setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Mode: ${current.label}`}
          className={`flex items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-2 transition-colors ${
            onModeChange ? 'hover:bg-white/5' : 'cursor-default'
          }`}
        >
          <span className="text-[18px] leading-none font-medium tracking-[-0.02em] text-white">
            Sol
          </span>
          <span className="text-muted mt-[3px] text-[11.5px] leading-none font-medium tracking-[0.08em] uppercase">
            AIR
          </span>
          {mode !== 'fast' && (
            <span className="ml-1 rounded-full border border-[#ffc627]/40 bg-[#ffc627]/10 px-2 py-0.5 text-[12px] leading-none text-[#ffc627]">
              {current.label}
            </span>
          )}
          <Chevron
            className={`text-fg mt-[1px] size-[18px] transition-transform ${open ? 'rotate-180' : ''}`}
          />
          <span className="bg-asu-gold ml-1 size-[7px] rounded-full" />
        </button>

        {open && onModeChange && (
          <div
            role="menu"
            className="animate-rise absolute top-full left-1 z-40 mt-2 w-[300px] rounded-2xl border border-white/10 bg-[#1e1f20] p-1.5 shadow-2xl shadow-black/60"
          >
            {MODES.map((m) => {
              const active = m.id === mode
              return (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onModeChange(m.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-white/[0.06]' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-fg flex items-center gap-2 text-[15px]">
                      {m.id === 'council' && <CouncilIcon className="size-4 text-[#ffc627]" />}
                      {m.label}
                      <span className="text-muted font-mono text-[11.5px]">{m.model}</span>
                    </span>
                    <span className="text-muted mt-0.5 block text-[12.5px] leading-snug">
                      {m.hint}
                    </span>
                  </span>
                  <Check
                    className={`mt-1 size-4 shrink-0 ${active ? 'text-[#ffc627]' : 'text-transparent'}`}
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="New chat"
        onClick={onNewChat}
        className="bg-surface text-fg flex size-12 items-center justify-center rounded-full transition-colors hover:bg-[#2a2a2a] active:scale-95"
      >
        <ComposePencil className="size-[22px]" />
      </button>

      {asurite ? (
        /* Not interactive — sign out lives in the side nav. */
        <div
          title={asurite}
          aria-label={`Signed in as ${asurite}`}
          className="size-12 shrink-0 rounded-full bg-[linear-gradient(140deg,#8c1d40,#c2436a_45%,#ffc627)] p-[2px]"
        >
          <span className="bg-surface flex size-full items-center justify-center rounded-full text-[13px] font-medium tracking-[-0.02em] text-white uppercase">
            {asurite.slice(0, 2)}
          </span>
        </div>
      ) : (
        <a
          href="/api/auth/login"
          className="bg-asu-maroon flex h-11 shrink-0 items-center rounded-full px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#a52350] active:scale-95"
        >
          Sign in
        </a>
      )}
    </header>
  )
}
