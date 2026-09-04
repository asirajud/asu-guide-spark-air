import {
  LANDMARKS,
  SHUTTLE_STOPS,
  WATER_POINTS,
  type LatLng,
  type SegmentKind,
} from './heatroute-data'
import type { EvaluatedRoute } from './heatroute-engine'

type Position = [number, number]

type LineStringGeometry = {
  type: 'LineString'
  coordinates: Position[]
}

type PointGeometry = {
  type: 'Point'
  coordinates: Position
}

type Feature<TGeometry, TProperties> = {
  type: 'Feature'
  id: string
  geometry: TGeometry
  properties: TProperties
}

export type FeatureCollection<TGeometry, TProperties> = {
  type: 'FeatureCollection'
  features: Array<Feature<TGeometry, TProperties>>
}

export type HeatRouteLineProperties = {
  routeId: string
  routeLabel: string
  segmentId: string
  label: string
  kind: SegmentKind
  color: string
  lineWidth: number
  opacity: number
  selected: boolean
  recommended: boolean
  exposurePercent: number
}

export type HeatRoutePointProperties = {
  id: string
  label: string
  category: 'landmark' | 'water' | 'shuttle'
  color: string
  involved: boolean
  etaMinutes?: number
}

export const HEATROUTE_KIND_STYLE: Record<SegmentKind, { stroke: string; label: string }> = {
  sun: { stroke: '#f97316', label: 'Open sun' },
  shade: { stroke: '#22c55e', label: 'Tree / building shade' },
  indoor: { stroke: '#60a5fa', label: 'Indoor connector' },
  covered: { stroke: '#a78bfa', label: 'Covered walkway' },
  shuttle: { stroke: '#ffc627', label: 'Shuttle' },
}

/** Accept the full MapLibre style URL documented by the app or a bare MapTiler key. */
export function heatRouteStyleUrl(value: string | undefined): string | null {
  const configured = value?.trim()
  if (!configured) return null
  if (/^https?:\/\//i.test(configured)) return configured
  if (/^[A-Za-z0-9_-]+$/.test(configured)) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(configured)}`
  }
  return null
}

export const HEATROUTE_MAP_CONFIG = {
  styleUrl: heatRouteStyleUrl(process.env.NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL),
  center: [-111.9332, 33.4201] satisfies Position,
  defaultZoom: 15.35,
  maxBounds: [
    [-111.9415, 33.413],
    [-111.925, 33.429],
  ] satisfies [Position, Position],
  attributionControl: true,
}

export function latLngToPosition(point: LatLng): Position {
  return [point.lng, point.lat]
}

function routeVisualState(
  route: EvaluatedRoute,
  selectedRouteId?: string,
  recommendedRouteId?: string,
) {
  const selected = route.id === selectedRouteId
  const recommended = route.id === recommendedRouteId
  return {
    selected,
    recommended,
    lineWidth: selected ? 7 : recommended ? 5 : 3,
    opacity: selected ? 1 : recommended ? 0.82 : 0.28,
  }
}

export function routeSegmentsToGeoJson(
  routes: EvaluatedRoute[],
  selectedRouteId?: string,
  recommendedRouteId?: string,
): FeatureCollection<LineStringGeometry, HeatRouteLineProperties> {
  return {
    type: 'FeatureCollection',
    features: routes.flatMap((route) => {
      const state = routeVisualState(route, selectedRouteId, recommendedRouteId)
      return route.evaluatedSegments.map((segment) => ({
        type: 'Feature' as const,
        id: `${route.id}:${segment.id}`,
        geometry: {
          type: 'LineString' as const,
          coordinates: segment.path.map(latLngToPosition),
        },
        properties: {
          routeId: route.id,
          routeLabel: route.label,
          segmentId: segment.id,
          label: segment.label,
          kind: segment.kind,
          color: HEATROUTE_KIND_STYLE[segment.kind].stroke,
          lineWidth: state.selected
            ? Math.min(9, state.lineWidth + segment.exposurePercent / 60)
            : state.lineWidth,
          opacity: state.opacity,
          selected: state.selected,
          recommended: state.recommended,
          exposurePercent: segment.exposurePercent,
        },
      }))
    }),
  }
}

export function mapPointsToGeoJson(
  selectedRoute?: EvaluatedRoute | null,
): FeatureCollection<PointGeometry, HeatRoutePointProperties> {
  const involvedLandmarks = new Set(
    selectedRoute ? [selectedRoute.startId, selectedRoute.endId] : [],
  )

  return {
    type: 'FeatureCollection',
    features: [
      ...LANDMARKS.map((landmark) => ({
        type: 'Feature' as const,
        id: `landmark:${landmark.id}`,
        geometry: {
          type: 'Point' as const,
          coordinates: latLngToPosition(landmark),
        },
        properties: {
          id: landmark.id,
          label: landmark.shortLabel,
          category: 'landmark' as const,
          color: involvedLandmarks.has(landmark.id) ? '#ffc627' : '#e5e7eb',
          involved: involvedLandmarks.has(landmark.id),
        },
      })),
      ...WATER_POINTS.map((point) => ({
        type: 'Feature' as const,
        id: `water:${point.id}`,
        geometry: {
          type: 'Point' as const,
          coordinates: latLngToPosition(point),
        },
        properties: {
          id: point.id,
          label: 'Water',
          category: 'water' as const,
          color: '#38bdf8',
          involved: false,
        },
      })),
      ...SHUTTLE_STOPS.map((stop) => ({
        type: 'Feature' as const,
        id: `shuttle:${stop.id}`,
        geometry: {
          type: 'Point' as const,
          coordinates: latLngToPosition(stop),
        },
        properties: {
          id: stop.id,
          label: 'Shuttle',
          category: 'shuttle' as const,
          color: '#ffc627',
          involved: false,
          etaMinutes: stop.etaMinutes,
        },
      })),
    ],
  }
}

export function routeBounds(route?: EvaluatedRoute | null): [Position, Position] | null {
  if (!route) return null
  const positions = route.evaluatedSegments.flatMap((segment) => segment.path.map(latLngToPosition))
  if (positions.length === 0) return null

  const lngs = positions.map(([lng]) => lng)
  const lats = positions.map(([, lat]) => lat)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}
