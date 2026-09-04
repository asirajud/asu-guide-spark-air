'use client'

import { Chevron, ComposePencil, Hamburger } from '@/components/icons'

/** Mirrors the Gemini app bar: hamburger · "Sol AIR ⌄ •" · compose · avatar. */
export function Header({
  onMenu,
  onNewChat,
  asurite,
  view,
  onToggleView,
}: {
  onMenu?: () => void
  onNewChat?: () => void
  /** ASURITE of the signed-in user, or null when signed out. */
  asurite?: string | null
  /** Current view: 'chat' or 'heatroute' */
  view?: 'chat' | 'heatroute'
  /** Callback when view changes */
  onToggleView?: () => void
}) {
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

      <div className="flex flex-1 items-center gap-1.5 pl-1">
        <span className="text-[18px] leading-none font-medium tracking-[-0.02em] text-white">
          Sol
        </span>
        <span className="text-muted text-[18px] leading-none font-normal tracking-[-0.02em]">
          AIR
        </span>
        <Chevron className="text-fg mt-[1px] size-[18px]" />
        <span className="bg-asu-gold ml-1.5 size-[7px] rounded-full" />
      </div>

      {/* View switcher */}
      {onToggleView && (
        <button
          type="button"
          onClick={onToggleView}
          className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors ${
            view === 'heatroute' ? 'bg-[#2a2a2a] text-[#C2436A]' : 'text-muted hover:bg-[#2a2a2a]'
          }`}
        >
          <span>HeatRoute</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              view === 'heatroute' ? 'bg-[#C2436A]' : 'bg-transparent'
            }`}
          />
        </button>
      )}

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
