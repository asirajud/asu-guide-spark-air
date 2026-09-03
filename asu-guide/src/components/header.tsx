'use client'

import { Chevron, ComposePencil, Hamburger } from '@/components/icons'

/** Mirrors the Gemini app bar: hamburger · "ASU Guide AIR ⌄ •" · compose · avatar. */
export function Header({
  onMenu,
  onNewChat,
  asurite,
}: {
  onMenu?: () => void
  onNewChat?: () => void
  /** ASURITE of the signed-in user, or null when signed out. */
  asurite?: string | null
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="bg-surface text-fg flex size-12 items-center justify-center rounded-full transition-colors hover:bg-[#2a2a2a] active:scale-95"
      >
        <Hamburger className="size-6" />
      </button>

      <div className="flex flex-1 items-center gap-1.5 pl-1">
        <span className="text-[18px] leading-none font-medium tracking-[-0.02em] text-white">
          ASU&nbsp;Guide
        </span>
        <span className="text-muted text-[18px] leading-none font-normal tracking-[-0.02em]">
          AIR
        </span>
        <Chevron className="text-fg mt-[1px] size-[18px]" />
        <span className="bg-blue ml-1.5 size-[7px] rounded-full" />
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
        <a
          href="/api/auth/logout"
          title={`${asurite} · sign out`}
          aria-label={`Signed in as ${asurite}. Sign out.`}
          className="size-12 shrink-0 rounded-full bg-[linear-gradient(140deg,#8ab4f8,#c58af9_55%,#f28b82)] p-[2px]"
        >
          <span className="bg-surface flex size-full items-center justify-center rounded-full text-[13px] font-medium tracking-[-0.02em] text-white uppercase">
            {asurite.slice(0, 2)}
          </span>
        </a>
      ) : (
        <a
          href="/api/auth/login"
          className="flex h-11 shrink-0 items-center rounded-full bg-[#1f3a5f] px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#264872] active:scale-95"
        >
          Sign in
        </a>
      )}
    </header>
  )
}
