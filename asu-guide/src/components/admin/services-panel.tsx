'use client'

import { useEffect, useState } from 'react'
import { SearchIcon } from '@/components/icons'
import { Toggle } from '@/components/admin/toggle'

type Tool = {
  name: string
  description: string
  method: string
  path: string
  enabled: boolean
  updatedBy: string | null
}

type Service = {
  id: string
  description: string
  baseUrl: string
  contractVersion: string
  healthy: boolean | null
  latencyMs: number | null
  tools: Tool[]
}

type Snapshot = { services: Service[]; error: string | null; effective: string[] }

export function ServicesPanel() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  /** Filters tools by name, path, description or owning service. Empty shows everything. */
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/admin/services')
        if (!res.ok) throw new Error('The service registry could not be read.')
        const body = (await res.json()) as Snapshot
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) {
          setFailure(err instanceof Error ? err.message : 'The service registry could not be read.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(name: string, enabled: boolean) {
    const previous = data
    // Optimistic, so the switch moves under the finger rather than after a round trip.
    setData((d) =>
      d
        ? {
            ...d,
            services: d.services.map((s) => ({
              ...s,
              tools: s.tools.map((t) => (t.name === name ? { ...t, enabled } : t)),
            })),
          }
        : d,
    )
    setBusy(name)
    setFailure(null)
    try {
      const res = await fetch('/api/admin/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled }),
      })
      if (!res.ok) throw new Error('That change was not saved.')
      setData((await res.json()) as Snapshot)
    } catch (err) {
      setData(previous)
      setFailure(err instanceof Error ? err.message : 'That change was not saved.')
    } finally {
      setBusy(null)
    }
  }

  if (!data && !failure) {
    return <p className="text-muted mt-8 text-[13.5px]">Reading the registry…</p>
  }

  const enabledCount = data?.services.flatMap((s) => s.tools).filter((t) => t.enabled).length ?? 0

  const q = query.trim().toLowerCase()
  const matches = (s: Service, t: Tool) =>
    !q || [t.name, t.path, t.method, t.description, s.id].join(' ').toLowerCase().includes(q)
  // A service stays only while at least one of its tools matches.
  const visible = (data?.services ?? [])
    .map((s) => ({ ...s, tools: s.tools.filter((t) => matches(s, t)) }))
    .filter((s) => s.tools.length > 0)
  const totalTools = data?.services.flatMap((s) => s.tools).length ?? 0
  const shownTools = visible.flatMap((s) => s.tools).length

  return (
    <div className="mt-8 flex flex-col gap-4">
      {failure && (
        <p
          role="alert"
          className="rounded-2xl border border-[#5c1229] bg-[#2a1119] px-4 py-3 text-[13.5px] text-[#ff8f8f]"
        >
          {failure}
        </p>
      )}

      {data?.error && (
        <p className="text-muted rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[13.5px] leading-relaxed">
          asu-tools-api is not answering, so nothing can be listed. Start it with{' '}
          <span className="font-mono text-[12.5px]">./dev.sh</span> and reload. Saved on/off choices
          are kept and will apply as soon as it is back.
        </p>
      )}

      {data && !data.error && (
        <div className="flex items-center gap-3">
          <label className="relative min-w-0 flex-1">
            <SearchIcon className="text-muted pointer-events-none absolute top-1/2 left-4 size-[17px] -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tools — name, path, description or service"
              aria-label="Filter tools"
              className="placeholder:text-muted/70 h-11 w-full rounded-full border border-white/12 bg-black/40 pr-4 pl-11 text-[15px] text-white outline-none focus:border-[#ffc627]/60"
            />
          </label>
          <span className="text-muted shrink-0 text-[13px] tabular-nums">
            {q ? `${shownTools} of ${totalTools}` : `${totalTools} tools`}
          </span>
        </div>
      )}

      {data && !data.error && q && visible.length === 0 && (
        <p className="text-muted rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[14px]">
          No tool matches “{query.trim()}”.
        </p>
      )}

      {visible.map((s) => (
        <section key={s.id} className="rounded-3xl border border-white/8 bg-[#0e0e0f] p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              aria-hidden
              className={`size-[8px] shrink-0 rounded-full ${
                s.healthy === true
                  ? 'bg-[#9ad4a4]'
                  : s.healthy === false
                    ? 'bg-[#ff8f8f]'
                    : 'bg-[#8e9195]'
              }`}
            />
            <h2 className="font-mono text-[15.5px] font-medium text-white">{s.id}</h2>
            <span className="text-muted text-[12px]">
              {s.healthy === true
                ? `Healthy${s.latencyMs != null ? ` · ${s.latencyMs.toFixed(0)}ms` : ''}`
                : s.healthy === false
                  ? 'Not responding'
                  : 'Unknown'}
            </span>
            <div className="flex-1" />
            <span className="text-muted font-mono text-[11.5px]">{s.baseUrl}</span>
            {s.contractVersion && (
              <span className="text-muted rounded-full border border-white/12 px-2 py-0.5 text-[10.5px]">
                v{s.contractVersion}
              </span>
            )}
          </div>

          {s.description && (
            <p className="text-muted mt-2 max-w-[70ch] text-[13.5px] leading-relaxed">
              {s.description}
            </p>
          )}

          <div className="mt-4 flex flex-col divide-y divide-white/6 border-t border-white/6">
            {s.tools.map((t) => (
              <div key={t.name} className="flex items-start gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={`font-mono text-[13.5px] ${t.enabled ? 'text-white' : 'text-muted line-through'}`}
                    >
                      {t.name}
                    </span>
                    {t.method && (
                      <span className="text-muted font-mono text-[11px]">
                        {t.method} {t.path}
                      </span>
                    )}
                  </div>
                  <p className="text-muted mt-1 max-w-[64ch] text-[12.5px] leading-relaxed">
                    {t.description}
                    {!t.enabled && t.updatedBy ? ` · switched off by ${t.updatedBy}` : ''}
                  </p>
                </div>
                <Toggle
                  label={`${t.enabled ? 'Disable' : 'Enable'} ${t.name}`}
                  checked={t.enabled}
                  busy={busy === t.name}
                  onChange={(next) => void toggle(t.name, next)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-3xl border border-white/8 bg-[#0e0e0f] p-5">
        <h2 className="text-[15.5px] font-medium text-white">Sent to the model</h2>
        <p className="text-muted mt-1.5 max-w-[68ch] text-[13px] leading-relaxed">
          Read back from the same call the chat route makes, so this is what the next turn actually
          carries — not a recalculation of the switches above.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(data?.effective ?? []).map((n) => (
            <span
              key={n}
              className="text-fg rounded-full border border-white/12 px-3 py-1 font-mono text-[12px]"
            >
              {n}
            </span>
          ))}
          {data?.effective.length === 0 && (
            <span className="text-muted text-[13px]">
              Nothing — Sol will answer from its own knowledge and say it cannot look events up.
            </span>
          )}
        </div>
      </section>

      <p className="text-muted mt-2 max-w-[68ch] text-[12.5px] leading-relaxed">
        A tool switched off is never sent, so it cannot be called by accident — and since every
        description is re-sent on each turn, switching one off also shortens the prompt.{' '}
        {enabledCount === 0 && 'With none enabled, Sol answers from its own knowledge only.'}
      </p>
    </div>
  )
}
