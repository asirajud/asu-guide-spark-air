'use client'

import type { ToolStep } from '@/lib/tool-trace'

/**
 * The assistant's tool calls for one turn, drawn as they happen. A failed step
 * stays visible in maroon next to the retry that fixed it — that recovery is
 * the point, so it is never collapsed away.
 */
export function ToolTrace({ steps, live = false }: { steps: ToolStep[]; live?: boolean }) {
  if (steps.length === 0) return null
  return (
    <ol
      aria-label="Tools the assistant used"
      className={`flex flex-col gap-1.5 text-[13px] leading-[1.35] tracking-[-0.005em] ${
        live ? '' : 'mb-4'
      }`}
    >
      {steps.map((s) => (
        <li key={s.id} className="animate-rise flex items-baseline gap-2.5">
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
      <span
        aria-label="running"
        className="bg-asu-gold inline-block size-[7px] shrink-0 translate-y-[-1px] animate-pulse rounded-full"
      />
    )
  }
  if (status === 'error') {
    return (
      <span aria-label="failed" className="text-asu-maroon shrink-0 text-[12px] leading-none">
        ✕
      </span>
    )
  }
  return (
    <span aria-label="done" className="shrink-0 text-[12px] leading-none text-[#7fd1a0]">
      ✓
    </span>
  )
}
