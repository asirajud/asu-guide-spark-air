'use client'

import { useMemo, useState } from 'react'
import { HeatRouteMap } from '@/components/heatroute-map'
import { SunIcon } from '@/components/icons'
import type { LandmarkId } from '@/lib/heatroute-data'
import { routesForJourney } from '@/lib/heatroute-engine'
import type { HeatRoutePlan } from '@/lib/tools'

const RISK = {
  low: 'text-emerald-300',
  moderate: 'text-yellow-300',
  high: 'text-orange-300',
  extreme: 'text-red-300',
} as Record<string, string>

/**
 * A HeatRoute answer, inline in the chat. The tool returned the plan; the map
 * is re-derived here from the same engine and data the /heat page uses, so the
 * card and the page can never disagree, and no geometry crosses the wire.
 */
export function HeatRouteCard({ plan }: { plan: HeatRoutePlan }) {
  const [selectedId, setSelectedId] = useState<string | null>(plan.recommendedId)
  const routes = useMemo(
    () =>
      routesForJourney({
        startId: plan.start.id as LandmarkId,
        endId: plan.destination.id as LandmarkId,
        departure: new Date(plan.departureIso),
        mobilityMode: plan.mobilityMode,
        includeShuttle: plan.includeShuttle,
      }),
    [plan],
  )
  const recommended = routes.find((r) => r.id === plan.recommendedId) ?? routes[0] ?? null
  const selected = routes.find((r) => r.id === selectedId) ?? recommended
  const when = new Date(plan.departureIso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="animate-rise mt-4 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02]">
      <div className="flex items-center gap-3 px-5 pt-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#3a1723] text-[#ffc627]">
          <SunIcon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-fg truncate text-[16px]">
            {plan.start.label} → {plan.destination.label}
          </p>
          <p className="text-muted text-[13.5px]">
            Leaving {when} · estimated exposure, pilot data
          </p>
        </div>
        <a
          href="/heat"
          className="text-muted hover:text-fg shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-[13px] transition-colors hover:bg-white/5"
        >
          Open HeatRoute
        </a>
      </div>

      {/* The real basemap when a map style is configured, the SVG pilot map
          fitted to this route otherwise — the same component the /heat page uses. */}
      {routes.length > 0 && (
        <div className="relative mt-3 h-[360px]">
          <HeatRouteMap routes={routes} selectedRoute={selected} recommended={recommended} fit />
        </div>
      )}

      <ul className="flex flex-col gap-1.5 px-3 pt-2 pb-3">
        {plan.routes.map((r) => {
          const active = r.id === (selected?.id ?? plan.recommendedId)
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-[#ffc627]/40 bg-[#ffc627]/[0.07]'
                    : 'border-transparent hover:bg-white/[0.04]'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="text-fg flex items-center gap-2 text-[15.5px]">
                    {r.label}
                    {r.id === plan.recommendedId && (
                      <span className="rounded-full bg-[#ffc627] px-2 py-0.5 text-[11px] font-medium text-black">
                        Recommended
                      </span>
                    )}
                  </span>
                  <span className="text-muted block text-[13px]">
                    {r.protectedMinutes}m protected · {r.waterStops}{' '}
                    {r.waterStops === 1 ? 'water stop' : 'water stops'}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="text-fg block text-[17px]">{r.durationMinutes}m</span>
                  <span className={`block text-[13px] ${RISK[r.heatRisk] ?? 'text-muted'}`}>
                    {r.exposurePercent}% sun
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
