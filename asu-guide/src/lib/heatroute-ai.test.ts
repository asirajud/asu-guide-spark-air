import { describe, expect, it } from 'vitest'
import { buildHeatRouteExplainPayload, summarizeRouteForAi } from './heatroute-ai'
import { routesForJourney } from './heatroute-engine'

const departure = new Date(2026, 8, 3, 12, 30, 0)

function routes() {
  return routesForJourney({
    startId: 'memorial-union',
    endId: 'hayden-library',
    departure,
    mobilityMode: false,
    includeShuttle: true,
  })
}

describe('HeatRoute AI payloads', () => {
  it('summarizes an evaluated route without geometry', () => {
    const [route] = routes()
    const summary = summarizeRouteForAi(route)

    expect(summary.id).toBe(route.id)
    expect(summary.exposurePercent).toBe(route.exposurePercent)
    expect(summary.segments[0]).toEqual(
      expect.objectContaining({
        label: expect.any(String),
        kind: expect.any(String),
        durationMinutes: expect.any(Number),
        exposurePercent: expect.any(Number),
        notes: expect.any(String),
      }),
    )
    expect(JSON.stringify(summary)).not.toContain('"path"')
    expect(JSON.stringify(summary)).not.toContain('"lat"')
    expect(JSON.stringify(summary)).not.toContain('"lng"')
  })

  it('builds the route explanation payload with selected and alternatives', () => {
    const routeOptions = routes()
    const selectedRoute = routeOptions[0]
    const payload = buildHeatRouteExplainPayload({
      start: 'Memorial Union',
      destination: 'Hayden Library',
      departure,
      departureLabel: 'Sep 3, 2026 at 12:30 PM',
      mobilityMode: false,
      includeShuttle: true,
      selectedRoute,
      recommendedRoute: routeOptions[0],
      routes: routeOptions,
    })

    expect(payload.start).toBe('Memorial Union')
    expect(payload.destination).toBe('Hayden Library')
    expect(payload.selectedRoute.id).toBe(selectedRoute.id)
    expect(payload.recommendedRoute?.id).toBe(routeOptions[0].id)
    expect(payload.alternatives.every((route) => route.id !== selectedRoute.id)).toBe(true)
    expect(payload.alternatives.length).toBeLessThanOrEqual(3)
  })
})
