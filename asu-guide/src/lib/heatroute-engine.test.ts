import { describe, expect, it } from 'vitest'
import { HEAT_ROUTES } from './heatroute-data'
import {
  evaluateRoute,
  getSunPosition,
  routesForJourney,
  validateHeatRouteData,
} from './heatroute-engine'

const noon = new Date(2026, 8, 3, 12, 30, 0)
const morning = new Date(2026, 8, 3, 8, 0, 0)

describe('HeatRoute data', () => {
  it('has valid curated pilot routes', () => {
    expect(validateHeatRouteData()).toEqual([])
    expect(HEAT_ROUTES.length).toBeGreaterThanOrEqual(6)
  })
})

describe('HeatRoute scoring', () => {
  it('keeps the direct MU to Hayden route as the fastest option', () => {
    const routes = routesForJourney({
      startId: 'memorial-union',
      endId: 'hayden-library',
      departure: noon,
      mobilityMode: false,
      includeShuttle: true,
    })
    const fastest = [...routes].sort((a, b) => a.durationMinutes - b.durationMinutes)[0]

    expect(fastest.id).toBe('mu-hayden-direct')
  })

  it('scores the indoor MU to Hayden route below direct sun exposure at noon', () => {
    const direct = HEAT_ROUTES.find((route) => route.id === 'mu-hayden-direct')
    const indoor = HEAT_ROUTES.find((route) => route.id === 'mu-hayden-indoor')

    expect(direct).toBeDefined()
    expect(indoor).toBeDefined()

    const directExposure = evaluateRoute(direct!, {
      departure: noon,
      mobilityMode: false,
      includeShuttle: true,
    }).exposurePercent
    const indoorExposure = evaluateRoute(indoor!, {
      departure: noon,
      mobilityMode: true,
      includeShuttle: true,
    }).exposurePercent

    expect(indoorExposure).toBeLessThan(directExposure)
  })

  it('removes shuttle routes when shuttle preference is disabled', () => {
    const routes = routesForJourney({
      startId: 'lot-59',
      endId: 'memorial-union',
      departure: noon,
      mobilityMode: false,
      includeShuttle: false,
    })

    expect(routes.every((route) => route.strategy !== 'shuttle')).toBe(true)
  })

  it('changes the recommended Lot 59 route when shuttles are allowed', () => {
    const walkingOnly = routesForJourney({
      startId: 'lot-59',
      endId: 'memorial-union',
      departure: noon,
      mobilityMode: false,
      includeShuttle: false,
    })
    const withShuttle = routesForJourney({
      startId: 'lot-59',
      endId: 'memorial-union',
      departure: noon,
      mobilityMode: false,
      includeShuttle: true,
    })

    expect(walkingOnly[0].strategy).not.toBe('shuttle')
    expect(withShuttle[0].strategy).toBe('shuttle')
  })

  it('estimates higher open-sun exposure at noon than morning', () => {
    const direct = HEAT_ROUTES.find((route) => route.id === 'lot59-mu-direct')

    expect(direct).toBeDefined()

    const morningExposure = evaluateRoute(direct!, {
      departure: morning,
      mobilityMode: false,
      includeShuttle: true,
    }).exposurePercent
    const noonExposure = evaluateRoute(direct!, {
      departure: noon,
      mobilityMode: false,
      includeShuttle: true,
    }).exposurePercent

    expect(noonExposure).toBeGreaterThan(morningExposure)
  })

  it('computes a plausible Tempe sun position', () => {
    const sun = getSunPosition(noon, { lat: 33.4178, lng: -111.9344 })

    expect(sun.altitudeDeg).toBeGreaterThan(45)
    expect(sun.intensity).toBeGreaterThan(0.7)
  })
})
