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
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 font-semibold ${className}`}>{value}</div>
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
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        selected
          ? 'border-asu-gold bg-[#1d1b12]'
          : 'border-[#2b2d30] bg-[#111214] hover:border-[#4a4d52]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-white">{route.label}</span>
            {recommended && (
              <span className="rounded-full bg-asu-gold px-2 py-0.5 text-[10px] font-bold text-black">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{route.description}</p>
        </div>
        <span className="shrink-0 text-[18px] font-semibold text-white">
          {route.durationMinutes}m
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
        <Metric
          label="Sun"
          value={`${route.exposurePercent}%`}
          className={RISK_STYLE[route.heatRisk]}
        />
        <Metric label="Protected" value={`${route.protectedMinutes}m`} />
        <Metric label="Water" value={`${route.waterStops}`} />
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#25272a]">
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
    <div className="flex h-full min-h-0 w-full flex-col bg-[#070809] text-white">
      <div className="border-b border-[#24262a] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <SunIcon className="size-5 text-asu-gold" />
              <h1 className="text-[20px] font-semibold">HeatRoute ASU</h1>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              Estimated heat-aware routing for Tempe campus. Not turn-by-turn navigation.
            </p>
          </div>
          <div className="rounded-full border border-[#34373c] px-3 py-1.5 text-[12px] text-muted">
            Verified pilot data - {displayDate('2026-09-03')}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-[#24262a] p-4 lg:border-r lg:border-b-0 lg:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Start
              </span>
              <select
                value={startId}
                onChange={(event) => {
                  const nextStartId = event.target.value as LandmarkId
                  const nextDestination = availableDestinations(nextStartId)[0]
                  setStartId(nextStartId)
                  if (nextDestination) setEndId(nextDestination.id)
                  setSelectedRouteId(null)
                }}
                className="mt-1.5 h-10 w-full rounded-md border border-[#33363b] bg-[#111214] px-3 text-[14px] text-white outline-none focus:border-asu-gold"
              >
                {START_LANDMARKS.map((landmark) => (
                  <option key={landmark.id} value={landmark.id}>
                    {landmark.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Destination
              </span>
              <select
                value={effectiveEndId}
                onChange={(event) => {
                  setEndId(event.target.value as LandmarkId)
                  setSelectedRouteId(null)
                }}
                className="mt-1.5 h-10 w-full rounded-md border border-[#33363b] bg-[#111214] px-3 text-[14px] text-white outline-none focus:border-asu-gold"
              >
                {destinations.map((landmark) => (
                  <option key={landmark.id} value={landmark.id}>
                    {landmark.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-[#33363b] bg-[#111214] px-3 text-[14px] text-white outline-none focus:border-asu-gold"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Depart
              </span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-[#33363b] bg-[#111214] px-3 text-[14px] text-white outline-none focus:border-asu-gold"
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

          <div className="mt-4 rounded-lg border border-[#2b2d30] bg-[#101113] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Sun position
              </span>
              <span className="text-[12px] text-white">{timeToLabel(time)}</span>
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
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Route options
              </h2>
              <span className="text-[12px] text-muted">{rankedRoutes.length} candidates</span>
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
              <div className="rounded-lg border border-[#2b2d30] bg-[#101113] p-4 text-[13px] text-muted">
                No curated route is available for this pair yet.
              </div>
            )}
          </div>
        </aside>

        <main className="relative min-h-[620px] overflow-hidden bg-[#0b0c0e]">
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
    <div className="mt-4 rounded-lg border border-[#2b2d30] bg-[#101113] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            AI route note
          </div>
          <div className="mt-1 text-[13px] text-white">
            {route ? route.label : 'Select a route'}
          </div>
        </div>
        <button
          type="button"
          onClick={onExplain}
          disabled={!route || loading}
          className="h-8 shrink-0 rounded-full bg-asu-gold px-3 text-[12px] font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Thinking...' : 'Explain'}
        </button>
      </div>

      {explanation && (
        <p className="mt-3 text-[13px] leading-relaxed text-[#d8dcdf]">{explanation}</p>
      )}
      {error && <p className="mt-3 text-[13px] leading-relaxed text-red-300">{error}</p>}
      {!explanation && !error && (
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Uses ASU AIR to summarize the selected route from the estimated HeatRoute data.
        </p>
      )}
      {model && <div className="mt-2 text-[10px] uppercase tracking-wide text-muted">{model}</div>}
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
      className="flex items-center justify-between gap-3 rounded-lg border border-[#2b2d30] bg-[#101113] p-3 text-left"
    >
      <span>
        <span className="block text-[14px] font-medium text-white">{label}</span>
        <span className="mt-0.5 block text-[12px] text-muted">{note}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-asu-gold' : 'bg-[#3a3d42]'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}

function RouteDetails({ route }: { route: EvaluatedRoute }) {
  return (
    <div className="absolute right-4 bottom-4 left-4 rounded-lg border border-[#2b2d30] bg-[#0c0d0f]/95 p-4 shadow-2xl backdrop-blur lg:left-auto lg:w-[360px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">{route.label}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{route.verificationNotes}</p>
        </div>
        <span className={`text-[18px] font-bold ${RISK_STYLE[route.heatRisk]}`}>
          {route.exposurePercent}%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-[12px]">
        <Metric label="Walk" value={`${route.durationMinutes}m`} />
        <Metric label="Distance" value={metersToMiles(route.distanceMeters)} />
        <Metric label="Confidence" value={`${route.confidence}%`} />
        <Metric label="Risk" value={route.heatRisk} className={RISK_STYLE[route.heatRisk]} />
      </div>
      <p className="mt-3 text-[12px] leading-snug text-muted">
        Lines are approximate campus corridors, not exact walking paths through buildings.
      </p>

      <div className="mt-4 space-y-2">
        {route.evaluatedSegments.map((segment) => (
          <div key={segment.id} className="flex items-start gap-3 rounded-md bg-white/[0.04] p-2.5">
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: HEATROUTE_KIND_STYLE[segment.kind].stroke }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px] font-medium text-white">{segment.label}</span>
                <span className="shrink-0 text-[12px] text-muted">
                  {segment.durationMinutes}m - {segment.exposurePercent}% sun
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">{segment.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
