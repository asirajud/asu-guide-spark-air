import type { EvaluatedRoute } from './heatroute-engine'

export type HeatRouteAiRouteSummary = {
  id: string
  label: string
  strategy: EvaluatedRoute['strategy']
  durationMinutes: number
  exposurePercent: number
  protectedMinutes: number
  waterStops: number
  shuttleWaitMinutes: number
  confidence: number
  heatRisk: EvaluatedRoute['heatRisk']
  reasons: string[]
  segments: Array<{
    label: string
    kind: string
    durationMinutes: number
    exposurePercent: number
    notes: string
  }>
}

export type HeatRouteExplainPayload = {
  start: string
  destination: string
  departureIso: string
  departureLabel: string
  mobilityMode: boolean
  includeShuttle: boolean
  selectedRoute: HeatRouteAiRouteSummary
  recommendedRoute: HeatRouteAiRouteSummary | null
  alternatives: HeatRouteAiRouteSummary[]
}

export function summarizeRouteForAi(route: EvaluatedRoute): HeatRouteAiRouteSummary {
  return {
    id: route.id,
    label: route.label,
    strategy: route.strategy,
    durationMinutes: route.durationMinutes,
    exposurePercent: route.exposurePercent,
    protectedMinutes: route.protectedMinutes,
    waterStops: route.waterStops,
    shuttleWaitMinutes: route.shuttleWaitMinutes,
    confidence: route.confidence,
    heatRisk: route.heatRisk,
    reasons: route.reasons,
    segments: route.evaluatedSegments.map((segment) => ({
      label: segment.label,
      kind: segment.kind,
      durationMinutes: segment.durationMinutes,
      exposurePercent: segment.exposurePercent,
      notes: segment.notes,
    })),
  }
}

export function buildHeatRouteExplainPayload({
  start,
  destination,
  departure,
  departureLabel,
  mobilityMode,
  includeShuttle,
  selectedRoute,
  recommendedRoute,
  routes,
}: {
  start: string
  destination: string
  departure: Date
  departureLabel: string
  mobilityMode: boolean
  includeShuttle: boolean
  selectedRoute: EvaluatedRoute
  recommendedRoute: EvaluatedRoute | null
  routes: EvaluatedRoute[]
}): HeatRouteExplainPayload {
  return {
    start,
    destination,
    departureIso: departure.toISOString(),
    departureLabel,
    mobilityMode,
    includeShuttle,
    selectedRoute: summarizeRouteForAi(selectedRoute),
    recommendedRoute: recommendedRoute ? summarizeRouteForAi(recommendedRoute) : null,
    alternatives: routes
      .filter((route) => route.id !== selectedRoute.id)
      .slice(0, 3)
      .map(summarizeRouteForAi),
  }
}
