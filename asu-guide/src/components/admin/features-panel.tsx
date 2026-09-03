'use client'

import { useState } from 'react'
import { Toggle } from '@/components/admin/toggle'

export type FeatureSlot = {
  id: string
  name: string
  summary: string
  defaultEnabled: boolean
  enabled: boolean
  updatedBy: string | null
}

/** On/off switches for features that ship dark. State is read back from the server after every flip. */
export function FeaturesPanel({ initial }: { initial: FeatureSlot[] }) {
  const [features, setFeatures] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function flip(id: string, enabled: boolean) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch('/api/admin/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: id, enabled }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        features?: FeatureSlot[]
        error?: string
      }
      if (!res.ok || !data.features) throw new Error(data.error ?? 'Could not save.')
      setFeatures(data.features)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-white/8 bg-[#0e0e0f] p-5">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[17px] font-medium text-white">Features</h2>
        <span className="text-muted text-[12px] tracking-[0.04em] uppercase">
          {features.length === 1 ? '1 switch' : `${features.length} switches`}
        </span>
      </div>
      <p className="text-muted mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed">
        Parts of Sol that ship dark. Off hides the entry in the side nav and answers 404 on its API.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-white/6">
        {features.map((f) => (
          <li key={f.id} className="flex items-start justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-[15px] text-white">
                {f.name}
                <span className="text-muted ml-2 text-[12px]">
                  default {f.defaultEnabled ? 'on' : 'off'}
                </span>
              </p>
              <p className="text-muted mt-1 max-w-[62ch] text-[13px] leading-relaxed">
                {f.summary}
              </p>
              {f.updatedBy && <p className="text-muted mt-1 text-[12px]">set by {f.updatedBy}</p>}
            </div>
            <Toggle
              checked={f.enabled}
              busy={busy === f.id}
              label={`${f.name} ${f.enabled ? 'on' : 'off'}`}
              onChange={(next) => void flip(f.id, next)}
            />
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-[13px] text-red-400">{error}</p>}
    </section>
  )
}
