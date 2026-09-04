'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { MapIcon } from '@/components/icons'
import { LANDMARKS, SHUTTLE_STOPS, WATER_POINTS } from '@/lib/heatroute-data'
import {
  HEATROUTE_KIND_STYLE,
  HEATROUTE_MAP_CONFIG,
  mapPointsToGeoJson,
  routeBounds,
  routeSegmentsToGeoJson,
} from '@/lib/heatroute-map'
import { pathToSvg, projectPoint, type EvaluatedRoute } from '@/lib/heatroute-engine'

const SEGMENT_SOURCE_ID = 'heatroute-segments'
const POINT_SOURCE_ID = 'heatroute-points'
const MAP_READY_TIMEOUT_MS = 12_000

function emptyCollection() {
  return {
    type: 'FeatureCollection' as const,
    features: [],
  }
}

function source(map: MapLibreMap, id: string) {
  return map.getSource(id) as GeoJSONSource | undefined
}

function addHeatRouteLayers(map: MapLibreMap) {
  if (!map.getSource(SEGMENT_SOURCE_ID)) {
    map.addSource(SEGMENT_SOURCE_ID, {
      type: 'geojson',
      data: emptyCollection(),
    })
  }

  if (!map.getLayer('heatroute-route-casing')) {
    map.addLayer({
      id: 'heatroute-route-casing',
      type: 'line',
      source: SEGMENT_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#050506',
        'line-opacity': ['get', 'opacity'],
        'line-width': ['+', ['to-number', ['get', 'lineWidth']], 3],
      },
    })
  }

  if (!map.getLayer('heatroute-route-lines')) {
    map.addLayer({
      id: 'heatroute-route-lines',
      type: 'line',
      source: SEGMENT_SOURCE_ID,
      filter: ['!=', ['get', 'kind'], 'shuttle'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['get', 'opacity'],
        'line-width': ['get', 'lineWidth'],
      },
    })
  }

  if (!map.getLayer('heatroute-shuttle-lines')) {
    map.addLayer({
      id: 'heatroute-shuttle-lines',
      type: 'line',
      source: SEGMENT_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'shuttle'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-dasharray': [1.3, 1.1],
        'line-opacity': ['get', 'opacity'],
        'line-width': ['get', 'lineWidth'],
      },
    })
  }

  if (!map.getSource(POINT_SOURCE_ID)) {
    map.addSource(POINT_SOURCE_ID, {
      type: 'geojson',
      data: emptyCollection(),
    })
  }

  if (!map.getLayer('heatroute-water-points')) {
    map.addLayer({
      id: 'heatroute-water-points',
      type: 'circle',
      source: POINT_SOURCE_ID,
      filter: ['==', ['get', 'category'], 'water'],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 5,
        'circle-stroke-color': '#082f49',
        'circle-stroke-width': 2,
      },
    })
  }

  if (!map.getLayer('heatroute-shuttle-points')) {
    map.addLayer({
      id: 'heatroute-shuttle-points',
      type: 'circle',
      source: POINT_SOURCE_ID,
      filter: ['==', ['get', 'category'], 'shuttle'],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 5,
        'circle-stroke-color': '#352600',
        'circle-stroke-width': 2,
      },
    })
  }

  if (!map.getLayer('heatroute-landmark-points')) {
    map.addLayer({
      id: 'heatroute-landmark-points',
      type: 'circle',
      source: POINT_SOURCE_ID,
      filter: ['==', ['get', 'category'], 'landmark'],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['case', ['get', 'involved'], 7, 5],
        'circle-stroke-color': '#111214',
        'circle-stroke-width': 2,
      },
    })
  }

  if (!map.getLayer('heatroute-point-labels')) {
    map.addLayer({
      id: 'heatroute-point-labels',
      type: 'symbol',
      source: POINT_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.2],
        'text-size': 11,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#050506',
        'text-halo-width': 1.5,
      },
    })
  }
}

function fitSelectedRoute(map: MapLibreMap, route: EvaluatedRoute | null) {
  const bounds = routeBounds(route)
  if (!bounds) return
  map.fitBounds(bounds, {
    duration: 450,
    maxZoom: 17.4,
    padding: { top: 80, right: 80, bottom: 180, left: 80 },
  })
}

export function HeatRouteMap({
  routes,
  selectedRoute,
  recommended,
}: {
  routes: EvaluatedRoute[]
  selectedRoute: EvaluatedRoute | null
  recommended: EvaluatedRoute | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const latestMapStateRef = useRef<{
    segmentData: ReturnType<typeof routeSegmentsToGeoJson>
    pointData: ReturnType<typeof mapPointsToGeoJson>
    selectedRoute: EvaluatedRoute | null
  }>({
    segmentData: emptyCollection() as ReturnType<typeof routeSegmentsToGeoJson>,
    pointData: emptyCollection() as ReturnType<typeof mapPointsToGeoJson>,
    selectedRoute,
  })
  const [mapReady, setMapReady] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const styleUrl = HEATROUTE_MAP_CONFIG.styleUrl
  const segmentData = useMemo(
    () => routeSegmentsToGeoJson(routes, selectedRoute?.id, recommended?.id),
    [recommended?.id, routes, selectedRoute?.id],
  )
  const pointData = useMemo(() => mapPointsToGeoJson(selectedRoute), [selectedRoute])

  useEffect(() => {
    latestMapStateRef.current = { segmentData, pointData, selectedRoute }
  }, [pointData, segmentData, selectedRoute])

  useEffect(() => {
    if (!styleUrl || !containerRef.current) return

    let cancelled = false
    let ready = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let retryId: ReturnType<typeof setInterval> | undefined
    const mapStyleUrl = styleUrl
    setMapFailed(false)

    function markFailed(map?: MapLibreMap | null) {
      if (ready || cancelled) return
      ready = true
      setMapReady(false)
      setMapFailed(true)
      map?.remove()
      if (!map || mapRef.current === map) mapRef.current = null
    }

    function markReady(map: MapLibreMap) {
      if (ready || cancelled) return
      const latest = latestMapStateRef.current
      try {
        addHeatRouteLayers(map)
        source(map, SEGMENT_SOURCE_ID)?.setData(latest.segmentData)
        source(map, POINT_SOURCE_ID)?.setData(latest.pointData)
        fitSelectedRoute(map, latest.selectedRoute)
        ready = true
        if (timeoutId) clearTimeout(timeoutId)
        if (retryId) clearInterval(retryId)
        setMapReady(true)
      } catch {
        ready = false
      }
    }

    function tryMarkReady(map: MapLibreMap) {
      if (ready || cancelled) return
      try {
        if (map.isStyleLoaded() === false) return
        markReady(map)
      } catch {
        // The style object can exist before it is ready for custom layers.
      }
    }

    async function mountMap() {
      try {
        const maplibregl = await import('maplibre-gl')
        if (cancelled || !containerRef.current) return

        const workerFile =
          process.env.NODE_ENV === 'development'
            ? '/maplibre/maplibre-gl-worker-dev.mjs'
            : '/maplibre/maplibre-gl-worker.mjs'
        maplibregl.setWorkerUrl(workerFile)

        const map = new maplibregl.Map({
          attributionControl: HEATROUTE_MAP_CONFIG.attributionControl ? { compact: true } : false,
          center: HEATROUTE_MAP_CONFIG.center,
          container: containerRef.current,
          maxBounds: HEATROUTE_MAP_CONFIG.maxBounds,
          pitchWithRotate: false,
          style: mapStyleUrl,
          zoom: HEATROUTE_MAP_CONFIG.defaultZoom,
        })
        mapRef.current = map
        map.setMissingStyleImageResolver((id) => {
          if (map.hasImage(id)) return
          map.addImage(id, {
            width: 1,
            height: 1,
            data: new Uint8Array([0, 0, 0, 0]),
          })
        })

        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: false,
            visualizePitch: false,
          }),
          'top-right',
        )

        timeoutId = setTimeout(() => markFailed(map), MAP_READY_TIMEOUT_MS)
        retryId = setInterval(() => tryMarkReady(map), 250)

        map.once('style.load', () => markReady(map))
        map.once('load', () => markReady(map))
        map.on('styledata', () => tryMarkReady(map))

        map.on('error', () => tryMarkReady(map))
      } catch {
        markFailed()
      }
    }

    void mountMap()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (retryId) clearInterval(retryId)
      setMapReady(false)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [styleUrl])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    source(mapRef.current, SEGMENT_SOURCE_ID)?.setData(segmentData)
    source(mapRef.current, POINT_SOURCE_ID)?.setData(pointData)
    fitSelectedRoute(mapRef.current, selectedRoute)
  }, [mapReady, pointData, segmentData, selectedRoute])

  if (!styleUrl) {
    return (
      <HeatRouteSvgMap
        routes={routes}
        selectedRoute={selectedRoute}
        recommended={recommended}
        fallbackReason="Set NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL to enable the real basemap."
      />
    )
  }

  if (mapFailed) {
    return (
      <HeatRouteSvgMap
        routes={routes}
        selectedRoute={selectedRoute}
        recommended={recommended}
        fallbackReason="The configured basemap could not load, so HeatRoute is using pilot map mode."
      />
    )
  }

  return (
    <div className="absolute inset-0 p-4 lg:p-6">
      <div className="flex h-full min-h-0 flex-col rounded-lg border border-[#24262a] bg-[#111214]">
        <MapHeader title="Tempe campus live map" />
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="h-full w-full" />
          <ApproximateRouteNotice />
          {!mapReady && (
            <div className="absolute inset-0 grid place-items-center bg-[#0b0c0e] text-[13px] text-muted">
              Loading Tempe basemap...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MapHeader({ title, fallbackReason }: { title: string; fallbackReason?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24262a] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <MapIcon className="size-4 shrink-0 text-asu-gold" />
        <span className="truncate text-[13px] font-semibold">{title}</span>
        {fallbackReason && (
          <span className="hidden truncate text-[11px] text-muted sm:inline">{fallbackReason}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        {Object.entries(HEATROUTE_KIND_STYLE).map(([kind, style]) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: style.stroke }} />
            {style.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ApproximateRouteNotice() {
  return (
    <div className="absolute top-3 left-3 z-10 max-w-[340px] rounded-md border border-[#34373c] bg-[#0c0d0f]/90 px-3 py-2 text-[12px] leading-snug text-muted shadow-xl backdrop-blur">
      Lines are approximate campus corridors, not exact walking paths.
    </div>
  )
}

function HeatRouteSvgMap({
  routes,
  selectedRoute,
  recommended,
  fallbackReason,
}: {
  routes: EvaluatedRoute[]
  selectedRoute: EvaluatedRoute | null
  recommended: EvaluatedRoute | null
  fallbackReason?: string
}) {
  return (
    <div className="absolute inset-0 p-4 lg:p-6">
      <div className="flex h-full min-h-0 flex-col rounded-lg border border-[#24262a] bg-[#111214]">
        <MapHeader title="Tempe campus pilot map" fallbackReason={fallbackReason} />

        <div className="relative min-h-0 flex-1">
          <ApproximateRouteNotice />
          {fallbackReason && (
            <div className="absolute top-16 left-3 z-10 max-w-[300px] rounded-md border border-[#34373c] bg-[#0c0d0f]/90 px-3 py-2 text-[12px] text-muted shadow-xl backdrop-blur">
              {fallbackReason}
            </div>
          )}
          <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="heatroute-grid" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#2b2d30" strokeWidth="0.18" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#heatroute-grid)" />
            <path d="M 18 52 L 87 52" stroke="#272a2f" strokeWidth="3" strokeLinecap="round" />
            <path d="M 45 10 L 45 90" stroke="#272a2f" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 10 74 L 84 35" stroke="#202328" strokeWidth="1.8" strokeLinecap="round" />

            {routes.map((route) => {
              const active = route.id === selectedRoute?.id
              const emphasized = active || route.id === recommended?.id
              return (
                <g key={route.id} opacity={active ? 1 : emphasized ? 0.75 : 0.22}>
                  {route.evaluatedSegments.map((segment) => {
                    const style = HEATROUTE_KIND_STYLE[segment.kind]
                    return (
                      <path
                        key={segment.id}
                        d={pathToSvg(segment.path)}
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={active ? 1.9 + segment.exposurePercent / 70 : 1.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={segment.kind === 'shuttle' ? '1.8 1.4' : undefined}
                      />
                    )
                  })}
                </g>
              )
            })}

            {WATER_POINTS.map((point) => {
              const projected = projectPoint(point)
              return (
                <g key={point.id}>
                  <circle cx={projected.x} cy={projected.y} r="1.25" fill="#38bdf8" />
                  <text
                    x={projected.x + 1.9}
                    y={projected.y + 0.8}
                    className="fill-[#a5f3fc] text-[2.2px]"
                  >
                    Water
                  </text>
                </g>
              )
            })}

            {SHUTTLE_STOPS.map((stop) => {
              const projected = projectPoint(stop)
              return (
                <g key={stop.id}>
                  <rect
                    x={projected.x - 1.1}
                    y={projected.y - 1.1}
                    width="2.2"
                    height="2.2"
                    rx="0.35"
                    fill="#ffc627"
                  />
                  <text
                    x={projected.x + 1.8}
                    y={projected.y + 0.8}
                    className="fill-[#ffe8a3] text-[2.2px]"
                  >
                    Shuttle
                  </text>
                </g>
              )
            })}

            {LANDMARKS.map((landmark) => {
              const projected = projectPoint(landmark)
              const involved = selectedRoute
                ? landmark.id === selectedRoute.startId || landmark.id === selectedRoute.endId
                : false
              return (
                <g key={landmark.id}>
                  <circle
                    cx={projected.x}
                    cy={projected.y}
                    r={involved ? 1.9 : 1.35}
                    fill={involved ? '#ffc627' : '#e5e7eb'}
                  />
                  <text
                    x={projected.x}
                    y={projected.y - 2.8}
                    textAnchor="middle"
                    className="fill-white text-[2.5px] font-semibold"
                  >
                    {landmark.shortLabel}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
