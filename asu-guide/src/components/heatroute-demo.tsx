'use client'

import { useMemo, useState } from 'react'
import { HeatRouteMap } from '@/components/heatroute-map'
import { SunIcon } from '@/components/icons'
import { HEAT_ROUTES, LANDMARKS, type LandmarkId } from '@/lib/heatroute-data'
import { buildHeatRouteExplainPayload } from '@/lib/heatroute-ai'
import { HEATROUTE_KIND_STYLE } from '@/lib/heatroute-map'
import {
  availableDestinations,
  getSunPosition,
  landmarkById,
  routesForJourney,
  type EvaluatedRoute,
} from '@/lib/heatroute-engine'

const RISK_STYLE = {
  low: 'text-emerald-300',
  moderate: 'text-yellow-300',
  high: 'text-orange-300',
  extreme: 'text-red-300',
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

function timeToLabel(time: string) {
  const [hourString, minute] = time.split(':')
  const hour = Number(hourString)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

function metersToMiles(meters: number) {
  return `${(meters / 1609.344).toFixed(1)} mi`
}

function displayDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function makeDeparture(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0)
}

const START_LANDMARKS = (() => {
  const ids = new Set(HEAT_ROUTES.map((route) => route.startId))
  return LANDMARKS.filter((landmark) => ids.has(landmark.id))
})()

function exposureBarColor(exposure: number) {
  if (exposure < 35) return 'bg-emerald-400'
  if (exposure < 55) return 'bg-yellow-300'
  if (exposure < 72) return 'bg-orange-400'
  return 'bg-red-400'
}

function Metric({
  label,
  value,
  className = 'text-white',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <div className="text-muted text-[12px] tracking-[0.06em] uppercase">{label}</div>
      <div className={`mt-1 text-[17px] font-medium tabular-nums ${className}`}>{value}</div>
    </div>
  )
}

function RouteOption({
  route,
  selected,
  recommended,
  onSelect,
}: {
  route: EvaluatedRoute
  selected: boolean
  recommended: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? 'border-[#ffc627]/40 bg-[#ffc627]/[0.07]'
          : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-medium text-white">{route.label}</span>
            {recommended && (
              <span className="rounded-full bg-[#ffc627] px-2 py-0.5 text-[11px] font-medium text-black">
                Recommended
              </span>
            )}
          </div>
          <p className="text-muted mt-1 text-[14px] leading-relaxed">{route.description}</p>
        </div>
        <span className="shrink-0 text-[20px] font-medium text-white tabular-nums">
          {route.durationMinutes}m
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric
          label="Sun"
          value={`${route.exposurePercent}%`}
          className={RISK_STYLE[route.heatRisk]}
        />
        <Metric label="Protected" value={`${route.protectedMinutes}m`} />
        <Metric label="Water" value={`${route.waterStops}`} />
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${exposureBarColor(route.exposurePercent)}`}
          style={{ width: `${route.exposurePercent}%` }}
        />
      </div>
    </button>
  )
}

export function HeatRouteDemo() {
  const [startId, setStartId] = useState<LandmarkId>('memorial-union')
  const [endId, setEndId] = useState<LandmarkId>('hayden-library')
  const [date, setDate] = useState(todayIso)
  const [time, setTime] = useState('12:30')
  const [mobilityMode, setMobilityMode] = useState(false)
  const [includeShuttle, setIncludeShuttle] = useState(true)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [aiInsight, setAiInsight] = useState<{
    key: string
    text: string
    model: string | null
  } | null>(null)
  const [aiError, setAiError] = useState<{ key: string; text: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const destinations = useMemo(() => availableDestinations(startId), [startId])
  const effectiveEndId = destinations.some((destination) => destination.id === endId)
    ? endId
    : (destinations[0]?.id ?? 'hayden-library')
  const departure = useMemo(() => makeDeparture(date, time), [date, time])
  const rankedRoutes = useMemo(
    () =>
      routesForJourney({
        startId,
        endId: effectiveEndId,
        departure,
        mobilityMode,
        includeShuttle,
      }),
    [departure, effectiveEndId, includeShuttle, mobilityMode, startId],
  )
  const recommended = rankedRoutes[0] ?? null
  const selectedRoute =
    rankedRoutes.find((route) => route.id === selectedRouteId) ?? recommended ?? null
  const sun = getSunPosition(departure, landmarkById(startId) ?? LANDMARKS[0])
  const startLabel = landmarkById(startId)?.label ?? startId
  const destinationLabel = landmarkById(effectiveEndId)?.label ?? effectiveEndId
  const departureLabel = `${displayDate(date)} at ${timeToLabel(time)}`
  const aiRouteKey = [
    startId,
    effectiveEndId,
    selectedRoute?.id ?? 'none',
    departure.toISOString(),
    mobilityMode ? 'mobility' : 'standard',
    includeShuttle ? 'shuttle' : 'walk',
  ].join(':')
  const visibleInsight = aiInsight?.key === aiRouteKey ? aiInsight : null
  const visibleError = aiError?.key === aiRouteKey ? aiError.text : null

  async function explainSelectedRoute() {
    if (!selectedRoute) return
    const requestKey = aiRouteKey

    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/heatroute/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildHeatRouteExplainPayload({
            start: startLabel,
            destination: destinationLabel,
            departure,
            departureLabel,
            mobilityMode,
            includeShuttle,
            selectedRoute,
            recommendedRoute: recommended,
            routes: rankedRoutes,
          }),
        ),
      })
      const data = (await res.json().catch(() => null)) as {
        explanation?: string
        model?: string
        error?: string
      } | null

      if (!res.ok || !data?.explanation) {
        throw new Error(data?.error ?? 'Could not generate an AI route explanation.')
      }

      setAiInsight({ key: requestKey, text: data.explanation, model: data.model ?? null })
    } catch (err) {
      setAiInsight(null)
      setAiError({
        key: requestKey,
        text: err instanceof Error ? err.message : 'Could not generate an AI route explanation.',
      })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col text-white">
      <div className="border-b border-white/6 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3a1723] text-[#ffc627]">
                <SunIcon className="size-[22px]" />
              </span>
              <div>
                <h1 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  HeatRoute ASU
                </h1>
                <p className="text-muted text-[15px]">
                  Estimated heat-aware routing for Tempe campus · not turn-by-turn navigation
                </p>
              </div>
            </div>
          </div>
          <div className="text-muted rounded-full border border-white/12 px-3 py-1.5 text-[13px]">
            Pilot data · verified {displayDate('2026-09-03')}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="thin-scroll min-h-0 overflow-y-auto border-b border-white/6 p-5 lg:border-r lg:border-b-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="block">
              <span className="text-muted text-[13px] tracking-[0.06em] uppercase">Start</span>
              <select
                value={startId}
                onChange={(event) => {
                  const nextStartId = event.target.value as LandmarkId
                  const nextDestination = availableDestinations(nextStartId)[0]
                  setStartId(nextStartId)
                  if (nextDestination) setEndId(nextDestination.id)
                  setSelectedRouteId(null)
                }}
                className="mt-2 h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 text-[15.5px] text-white outline-none focus:border-[#ffc627]/60"
              >
                {START_LANDMARKS.map((landmark) => (
                  <option key={landmark.id} value={landmark.id}>
                    {landmark.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-muted text-[13px] tracking-[0.06em] uppercase">
                Destination
              </span>
              <select
                value={effectiveEndId}
                onChange={(event) => {
                  setEndId(event.target.value as LandmarkId)
                  setSelectedRouteId(null)
                }}
                className="mt-2 h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 text-[15.5px] text-white outline-none focus:border-[#ffc627]/60"
              >
                {destinations.map((landmark) => (
                  <option key={landmark.id} value={landmark.id}>
                    {landmark.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-muted text-[13px] tracking-[0.06em] uppercase">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 text-[15.5px] text-white outline-none focus:border-[#ffc627]/60"
              />
            </label>

            <label className="block">
              <span className="text-muted text-[13px] tracking-[0.06em] uppercase">Depart</span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 text-[15.5px] text-white outline-none focus:border-[#ffc627]/60"
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Toggle
              label="Mobility needs"
              note="Prefer step-free indoor or covered segments"
              checked={mobilityMode}
              onChange={() => setMobilityMode((value) => !value)}
            />
            <Toggle
              label="Use shuttles"
              note="Include static pilot shuttle ETA routes"
              checked={includeShuttle}
              onChange={() => setIncludeShuttle((value) => !value)}
            />
          </div>

          <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted text-[13px] tracking-[0.06em] uppercase">
                Sun position
              </span>
              <span className="text-[15px] text-white">{timeToLabel(time)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Metric label="Altitude" value={`${Math.round(sun.altitudeDeg)} deg`} />
              <Metric label="Azimuth" value={`${Math.round(sun.azimuthDeg)} deg`} />
              <Metric label="Intensity" value={`${Math.round(sun.intensity * 100)}%`} />
            </div>
          </div>

          <AiRouteInsight
            explanation={visibleInsight?.text ?? null}
            error={visibleError}
            loading={aiLoading}
            model={visibleInsight?.model ?? null}
            route={selectedRoute}
            onExplain={explainSelectedRoute}
          />

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-muted text-[13px] tracking-[0.06em] uppercase">Route options</h2>
              <span className="text-muted text-[13.5px]">{rankedRoutes.length} candidates</span>
            </div>
            {rankedRoutes.length ? (
              rankedRoutes.map((route) => (
                <RouteOption
                  key={route.id}
                  route={route}
                  selected={selectedRoute?.id === route.id}
                  recommended={recommended?.id === route.id}
                  onSelect={() => setSelectedRouteId(route.id)}
                />
              ))
            ) : (
              <div className="text-muted rounded-3xl border border-white/8 bg-white/[0.02] p-5 text-[15px]">
                No curated route is available for this pair yet.
              </div>
            )}
          </div>
        </aside>

        <main className="relative min-h-[620px] overflow-hidden bg-black/30">
          <HeatRouteMap
            routes={rankedRoutes}
            selectedRoute={selectedRoute}
            recommended={recommended}
          />
          {selectedRoute && <RouteDetails route={selectedRoute} />}
        </main>
      </div>
    </div>
  )
}

function AiRouteInsight({
  explanation,
  error,
  loading,
  model,
  route,
  onExplain,
}: {
  explanation: string | null
  error: string | null
  loading: boolean
  model: string | null
  route: EvaluatedRoute | null
  onExplain: () => void
}) {
  return (
    <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-muted text-[13px] tracking-[0.06em] uppercase">
            Sol on this route
          </div>
          <div className="mt-1 text-[16px] text-white">
            {route ? route.label : 'Select a route'}
          </div>
        </div>
        <button
          type="button"
          onClick={onExplain}
          disabled={!route || loading}
          className="h-9 shrink-0 rounded-full bg-[#ffc627] px-4 text-[14px] font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Thinking…' : 'Explain'}
        </button>
      </div>

      {explanation && <p className="text-fg mt-3 text-[16px] leading-[1.55]">{explanation}</p>}
      {error && <p className="mt-3 text-[15px] leading-relaxed text-red-400">{error}</p>}
      {!explanation && !error && (
        <p className="text-muted mt-3 text-[14px] leading-relaxed">
          Explains the selected route from the estimated HeatRoute data, on ASU AIR.
        </p>
      )}
      {model && (
        <p className="text-muted mt-3 text-[12.5px]">
          Explained by <span className="text-fg/80">{model}</span> on ASU AIR
        </p>
      )}
    </div>
  )
}

function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string
  note: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span>
        <span className="block text-[15.5px] text-white">{label}</span>
        <span className="text-muted mt-0.5 block text-[13px]">{note}</span>
      </span>
      <span
        className={`relative h-[24px] w-[42px] shrink-0 rounded-full border transition-colors ${
          checked ? 'border-[#ffc627]/40 bg-[#ffc627]/25' : 'border-white/12 bg-white/6'
        }`}
      >
        <span
          className={`absolute top-[2px] size-[18px] rounded-full transition-all ${
            checked ? 'left-[21px] bg-[#ffc627]' : 'left-[2px] bg-[#8e9195]'
          }`}
        />
      </span>
    </button>
  )
}

function RouteDetails({ route }: { route: EvaluatedRoute }) {
  return (
    <div className="absolute right-4 bottom-4 left-4 rounded-3xl border border-white/10 bg-[#141415]/95 p-5 shadow-2xl backdrop-blur lg:left-auto lg:w-[380px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-medium tracking-[-0.01em]">{route.label}</h2>
          <p className="text-muted mt-1 text-[14px] leading-relaxed">{route.verificationNotes}</p>
        </div>
        <span className={`text-[22px] font-medium tabular-nums ${RISK_STYLE[route.heatRisk]}`}>
          {route.exposurePercent}%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Metric label="Walk" value={`${route.durationMinutes}m`} />
        <Metric label="Distance" value={metersToMiles(route.distanceMeters)} />
        <Metric label="Confidence" value={`${route.confidence}%`} />
        <Metric label="Risk" value={route.heatRisk} className={RISK_STYLE[route.heatRisk]} />
      </div>
      <p className="text-muted mt-3 text-[13px] leading-snug">
        Lines are approximate campus corridors, not exact walking paths through buildings.
      </p>

      <div className="mt-4 space-y-2">
        {route.evaluatedSegments.map((segment) => (
          <div key={segment.id} className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3">
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: HEATROUTE_KIND_STYLE[segment.kind].stroke }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[15px] text-white">{segment.label}</span>
                <span className="text-muted shrink-0 text-[13px] tabular-nums">
                  {segment.durationMinutes}m · {segment.exposurePercent}% sun
                </span>
              </div>
              <p className="text-muted mt-0.5 text-[13.5px] leading-snug">{segment.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
