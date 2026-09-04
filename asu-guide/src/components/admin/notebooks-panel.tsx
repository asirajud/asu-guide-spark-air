'use client'

import { useState } from 'react'
import { Toggle } from '@/components/admin/toggle'

export type NotebooksConfig = {
  enabled: boolean
  pageCap: number
  pageCapMin: number
  pageCapMax: number
}

/** The Notebooks switch and its page cap. Every save reads the effective state back from the server. */
export function NotebooksPanel({ initial }: { initial: NotebooksConfig }) {
  const [cfg, setCfg] = useState(initial)
  const [capDraft, setCapDraft] = useState(String(initial.pageCap))
  const [busy, setBusy] = useState<'enabled' | 'pageCap' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(patch: Partial<Pick<NotebooksConfig, 'enabled' | 'pageCap'>>) {
    setBusy(patch.enabled !== undefined ? 'enabled' : 'pageCap')
    setError(null)
    try {
      const res = await fetch('/api/admin/notebooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<NotebooksConfig> & {
        error?: string
      }
      if (!res.ok || typeof data.pageCap !== 'number' || typeof data.enabled !== 'boolean') {
        throw new Error(data.error ?? 'Could not save.')
      }
      setCfg(data as NotebooksConfig)
      setCapDraft(String(data.pageCap))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  const capNumber = Number(capDraft)
  const capValid =
    Number.isInteger(capNumber) && capNumber >= cfg.pageCapMin && capNumber <= cfg.pageCapMax
  const capDirty = capValid && capNumber !== cfg.pageCap

  return (
    <div className="mt-8 flex flex-col gap-5">
      <section className="rounded-3xl border border-white/8 bg-[#0e0e0f] p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium text-white">
              Enabled
              <span className="text-muted ml-2 text-[12px]">default off</span>
            </h2>
            <p className="text-muted mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed">
              Off hides Notebooks from the side nav and answers 404 on every notebook API, so a
              disabled feature looks like one that was never deployed.
            </p>
          </div>
          <Toggle
            checked={cfg.enabled}
            busy={busy === 'enabled'}
            label={`Notebooks ${cfg.enabled ? 'on' : 'off'}`}
            onChange={(next) => void save({ enabled: next })}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-[#0e0e0f] p-5">
        <h2 className="text-[17px] font-medium text-white">
          Pages per notebook
          <span className="text-muted ml-2 text-[12px]">
            {cfg.pageCapMin}–{cfg.pageCapMax}
          </span>
        </h2>
        <p className="text-muted mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed">
          A student can keep adding pages while earlier ones are still being read; they queue and
          are read in order. This is the most one notebook may hold in total. Each page is one OCR
          call plus one digest rewrite on AIR, so the cap is also a cost ceiling.
        </p>
        <form
          className="mt-4 flex items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (capDirty) void save({ pageCap: capNumber })
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={cfg.pageCapMin}
            max={cfg.pageCapMax}
            value={capDraft}
            onChange={(e) => setCapDraft(e.target.value)}
            aria-label="Pages per notebook"
            className="w-24 rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-[15px] text-white tabular-nums outline-none focus:border-[#ffc627]/60"
          />
          <button
            type="submit"
            disabled={!capDirty || busy === 'pageCap'}
            className="rounded-full bg-[#ffc627] px-4 py-2 text-[14px] font-medium text-black transition-opacity disabled:opacity-40"
          >
            {busy === 'pageCap' ? 'Saving…' : 'Save'}
          </button>
          {!capValid && (
            <span className="text-[13px] text-red-400">
              Whole number between {cfg.pageCapMin} and {cfg.pageCapMax}.
            </span>
          )}
        </form>
      </section>

      {error && <p className="text-[13px] text-red-400">{error}</p>}
    </div>
  )
}
