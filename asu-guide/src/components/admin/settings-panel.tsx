'use client'

import { useEffect, useState } from 'react'
import { Select, type Option } from '@/components/admin/select'
import type { Capability } from '@/lib/air/capabilities'
import type { AirService } from '@/lib/air/models'

type Slot = {
  service: AirService
  chosen: string | null
  recommended: string[]
  updatedBy: string | null
}

type Catalog = { models: string[]; source: 'air' | 'fallback'; error?: string }

export function SettingsPanel({
  capabilities,
  initial,
}: {
  capabilities: Capability[]
  initial: Slot[]
}) {
  const [slots, setSlots] = useState<Slot[]>(initial)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [saving, setSaving] = useState<AirService | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The catalog comes from the gateway, so a model added to AIR appears here
  // without a deploy. It is fetched after paint: the page is useful with the
  // saved choices alone, and this call crosses the VPN.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/admin/models')
        if (!res.ok) throw new Error('The model catalog could not be loaded.')
        const data = (await res.json()) as Catalog
        if (!cancelled) setCatalog(data)
      } catch (err) {
        if (!cancelled) {
          setCatalog({ models: [], source: 'fallback' })
          setError(err instanceof Error ? err.message : 'The model catalog could not be loaded.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function choose(service: AirService, model: string) {
    const previous = slots
    // Optimistic: the dropdown should not lag a click across the VPN.
    setSlots((s) => s.map((x) => (x.service === service ? { ...x, chosen: model } : x)))
    setSaving(service)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, model }),
      })
      if (!res.ok) throw new Error('That change was not saved.')
    } catch (err) {
      setSlots(previous)
      setError(err instanceof Error ? err.message : 'That change was not saved.')
    } finally {
      setSaving(null)
    }
  }

  function optionsFor(slot: Slot): Option[] {
    const recommended = new Set(slot.recommended)
    const rest = (catalog?.models ?? []).filter((m) => !recommended.has(m))
    return [
      ...slot.recommended.map((m, i) => ({
        value: m,
        label: m,
        group: 'Recommended',
        note: i === 0 ? 'Default' : undefined,
      })),
      ...rest.map((m) => ({ value: m, label: m, group: 'All models on AIR' })),
    ]
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-[#5c1229] bg-[#2a1119] px-4 py-3 text-[13.5px] text-[#ff8f8f]"
        >
          {error}
        </p>
      )}

      {catalog?.source === 'fallback' && (
        <p className="text-muted rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[13.5px] leading-relaxed">
          Showing only the models this app already knows about — the AIR gateway did not answer.
          Check the VPN if a model you expect is missing.
        </p>
      )}

      {capabilities.map((cap) => (
        <section key={cap.id} className="rounded-3xl border border-white/8 bg-[#0e0e0f] p-5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[17px] font-medium text-white">{cap.name}</h2>
            <span className="text-muted text-[12px] tracking-[0.04em] uppercase">
              {cap.slots.length === 1 ? '1 model' : `${cap.slots.length} models`}
            </span>
          </div>
          <p className="text-muted mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed">
            {cap.summary}
          </p>

          <div className="mt-5 flex flex-col gap-5">
            {cap.slots.map((s) => {
              const slot = slots.find((x) => x.service === s.service)
              if (!slot) return null
              const value = slot.chosen ?? slot.recommended[0] ?? null

              return (
                <div key={s.service}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <label className="text-[14px] text-white">{s.label}</label>
                    <span className="text-muted font-mono text-[11.5px]">{s.service}</span>
                    {saving === s.service && (
                      <span className="text-muted text-[11.5px]">Saving…</span>
                    )}
                  </div>

                  <Select
                    label={s.label}
                    value={value}
                    options={optionsFor(slot)}
                    onChange={(m) => void choose(s.service, m)}
                    placeholder={catalog ? 'Select a model' : 'Loading catalog…'}
                  />

                  <p className="text-muted mt-2 text-[12.5px] leading-relaxed">
                    {s.hint}
                    {slot.chosen && slot.chosen !== slot.recommended[0] && (
                      <>
                        {' '}
                        Overrides the default{' '}
                        <span className="font-mono text-[11.5px]">{slot.recommended[0]}</span>
                        {slot.updatedBy ? `, set by ${slot.updatedBy}` : ''}.
                      </>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <p className="text-muted mt-2 max-w-[68ch] text-[12.5px] leading-relaxed">
        A choice here is a preference, not a lock. If the gateway refuses the chosen model, the
        request still falls through the built-in chain for that capability rather than failing — so
        a bad pick costs a round trip, it cannot take Sol offline.
      </p>
    </div>
  )
}
