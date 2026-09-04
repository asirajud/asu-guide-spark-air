'use client'

import type { ToolStep } from '@/lib/tool-trace'

/**
 * The assistant's tool calls for one turn, drawn as they happen. A failed step
 * stays visible in maroon next to the retry that fixed it — that recovery is
 * the point, so it is never collapsed away.
 */
export function ToolTrace({ steps, live = false }: { steps: ToolStep[]; live?: boolean }) {
  if (steps.length === 0) return null
  const includesCouncil = steps.some((step) => step.kind === 'council')
  const includesTools = steps.some((step) => step.kind !== 'council')
  return (
    <ol
      aria-label={
        includesCouncil && includesTools
          ? 'Council deliberation and tools used'
          : includesCouncil
            ? 'Council deliberation'
            : 'Tools the assistant used'
      }
      className={`flex flex-col gap-1.5 text-[13px] leading-[1.35] tracking-[-0.005em] ${
        live ? '' : 'mb-4'
      }`}
    >
      {steps.map((s) => (
        <li key={s.id} className="animate-rise flex items-center gap-2">
          <StatusDot status={s.status} />
          <span className={s.status === 'error' ? 'text-fg/70' : 'text-fg/85'}>{s.label}</span>
          {s.status === 'running' ? (
            <span className="text-muted">…</span>
          ) : (
            <span
              className={`min-w-0 truncate ${
                s.status === 'error' ? 'text-[#e8889f]' : 'text-muted'
              }`}
              title={s.summary}
            >
              {s.status === 'error' ? 'failed · ' : ''}
              {s.summary}
              {s.ms !== undefined ? ` · ${(s.ms / 1000).toFixed(1)}s` : ''}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function StatusDot({ status }: { status: ToolStep['status'] }) {
  if (status === 'running') {
    return (
      <span aria-label="running" className="flex size-[15px] shrink-0 items-center justify-center">
        <span className="bg-asu-gold block size-[9px] animate-pulse rounded-full" />
      </span>
    )
  }
  if (status === 'error') {
    return (
      <svg aria-label="failed" viewBox="0 0 16 16" className="fill-asu-maroon size-[15px] shrink-0">
        <circle cx="8" cy="8" r="8" />
        <path
          d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg aria-label="done" viewBox="0 0 16 16" className="size-[15px] shrink-0 fill-[#3fb96f]">
      <circle cx="8" cy="8" r="8" />
      <path
        d="M4.6 8.3l2.3 2.3 4.5-4.9"
        fill="none"
        stroke="#0b1a10"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
