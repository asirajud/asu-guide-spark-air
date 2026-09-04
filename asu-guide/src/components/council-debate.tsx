'use client'

import { CouncilIcon } from '@/components/icons'
import type { CouncilContribution } from '@/lib/tool-trace'

const SPEAKERS = [
  { avatar: 'A', avatarClass: 'bg-[#ffc627] text-[#211600]', bubbleClass: 'border-[#ffc627]/20' },
  { avatar: 'R', avatarClass: 'bg-[#4285f4] text-white', bubbleClass: 'border-[#4285f4]/20' },
  { avatar: 'S', avatarClass: 'bg-[#8c1d40] text-white', bubbleClass: 'border-[#c84d73]/25' },
  { avatar: 'P', avatarClass: 'bg-[#3b9b69] text-white', bubbleClass: 'border-[#4db57c]/20' },
] as const

/** The Council's individual positions, presented as a small group conversation. */
export function CouncilDebate({ contributions }: { contributions: CouncilContribution[] }) {
  if (contributions.length === 0) return null

  return (
    <section aria-label="Council conversation" className="mb-6">
      <div className="flex items-center gap-2 border-b border-white/8 pb-3">
        <CouncilIcon aria-hidden className="size-4 shrink-0 text-[#ffc627]" />
        <h2 className="text-fg text-[14px] font-medium">Council conversation</h2>
        <span className="text-muted text-[12px]">{contributions.length} viewpoints</span>
      </div>

      <ol className="mt-4 space-y-4" aria-label="Council members' viewpoints">
        {contributions.map((contribution, index) => {
          const speaker = SPEAKERS[index % SPEAKERS.length]
          return (
            <li
              key={`${contribution.role}-${index}`}
              className="animate-rise flex items-start gap-3"
            >
              <span
                aria-hidden
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${speaker.avatarClass}`}
              >
                {speaker.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
                  <span className="text-fg text-[13px] font-semibold">{contribution.role}</span>
                  <span className="text-muted text-[11px]">
                    {contribution.model} · {(contribution.ms / 1000).toFixed(1)}s
                  </span>
                </div>
                <p
                  className={`text-fg/85 mt-1.5 rounded-2xl rounded-tl-md border bg-white/[0.035] px-4 py-3 text-[16px] leading-[1.55] tracking-[-0.01em] whitespace-pre-wrap ${speaker.bubbleClass}`}
                >
                  {contribution.text}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
