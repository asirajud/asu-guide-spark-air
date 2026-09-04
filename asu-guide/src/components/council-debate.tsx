'use client'

import { Chevron, CouncilIcon } from '@/components/icons'
import type { CouncilContribution } from '@/lib/tool-trace'

/** A compact, optional transcript: the final answer stays primary. */
export function CouncilDebate({ contributions }: { contributions: CouncilContribution[] }) {
  if (contributions.length === 0) return null

  return (
    <details className="group mb-4 border-l-2 border-[#ffc627]/45 pl-4">
      <summary className="text-fg/85 flex cursor-pointer list-none items-center gap-2 text-[13.5px] font-medium [&::-webkit-details-marker]:hidden">
        <CouncilIcon className="size-4 shrink-0 text-[#ffc627]" />
        <span>Council debate</span>
        <span className="text-muted font-normal">{contributions.length} perspectives</span>
        <Chevron
          aria-hidden
          className="text-muted ml-auto size-4 -rotate-90 transition-transform group-open:rotate-0"
        />
      </summary>
      <ol className="mt-3 space-y-4 pb-1">
        {contributions.map((contribution, index) => (
          <li key={`${contribution.role}-${index}`}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-fg text-[13px] font-medium">{contribution.role}</span>
              <span className="text-muted text-[11.5px]">
                {contribution.model} · {(contribution.ms / 1000).toFixed(1)}s
              </span>
            </div>
            <p className="text-fg/75 mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">
              {contribution.text}
            </p>
          </li>
        ))}
      </ol>
    </details>
  )
}
