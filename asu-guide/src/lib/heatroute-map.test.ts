import { describe, expect, it } from 'vitest'
import { routesForJourney } from './heatroute-engine'
import {
  HEATROUTE_KIND_STYLE,
  latLngToPosition,
  mapPointsToGeoJson,
  routeBounds,
  routeSegmentsToGeoJson,
} from './heatroute-map'

const departure = new Date(2026, 8, 3, 12, 30, 0)

function muToHaydenRoutes() {
  return routesForJourney({
    startId: 'memorial-union',
    endId: 'hayden-library',
    departure,
    mobilityMode: false,
    includeShuttle: true,
  })
}

describe('HeatRoute map GeoJSON', () => {
  it('converts lat/lng to GeoJSON [lng, lat] coordinates', () => {
    expect(latLngToPosition({ lat: 33.4178, lng: -111.9344 })).toEqual([-111.9344, 33.4178])
  })

  it('exports route segments as LineString features with style properties', () => {
    const routes = muToHaydenRoutes()
    const selected = routes.find((route) => route.id === 'mu-hayden-direct')
    const recommended = routes[0]
    const geojson = routeSegmentsToGeoJson(routes, selected?.id, recommended?.id)
    const directSegment = geojson.features.find((feature) =>
      feature.id.startsWith('mu-hayden-direct:'),
    )

    expect(geojson.type).toBe('FeatureCollection')
    expect(directSegment?.geometry.type).toBe('LineString')
    expect(directSegment?.geometry.coordinates[0]).toEqual([-111.9344, 33.4178])
    expect(directSegment?.properties.kind).toBe('sun')
    expect(directSegment?.properties.color).toBe(HEATROUTE_KIND_STYLE.sun.stroke)
    expect(directSegment?.properties.selected).toBe(true)
    expect(directSegment?.properties.lineWidth).toBeGreaterThan(7)
  })

  it('marks recommended route features separately from selected features', () => {
    const routes = muToHaydenRoutes()
    const recommended = routes[0]
    const selected = routes.find((route) => route.id !== recommended.id)
    const geojson = routeSegmentsToGeoJson(routes, selected?.id, recommended.id)
    const selectedFeature = geojson.features.find((feature) => feature.properties.selected)
    const recommendedFeature = geojson.features.find((feature) => feature.properties.recommended)

    expect(selectedFeature?.properties.routeId).toBe(selected?.id)
    expect(recommendedFeature?.properties.routeId).toBe(recommended.id)
    expect(selectedFeature?.properties.opacity).toBeGreaterThan(
      recommendedFeature?.properties.opacity ?? 0,
    )
  })

  it('exports landmarks, water points, and shuttle stops as Point features', () => {
    const [selected] = muToHaydenRoutes()
    const geojson = mapPointsToGeoJson(selected)
    const categories = new Set(geojson.features.map((feature) => feature.properties.category))
    const selectedLandmark = geojson.features.find(
      (feature) => feature.properties.id === 'memorial-union',
    )

    expect(categories).toEqual(new Set(['landmark', 'water', 'shuttle']))
    expect(geojson.features.every((feature) => feature.geometry.type === 'Point')).toBe(true)
    expect(selectedLandmark?.properties.involved).toBe(true)
  })

  it('computes a route bounds box for map fitting', () => {
    const [selected] = muToHaydenRoutes()
    const bounds = routeBounds(selected)

    expect(bounds).not.toBeNull()
    expect(bounds?.[0][0]).toBeLessThanOrEqual(bounds?.[1][0] ?? 0)
    expect(bounds?.[0][1]).toBeLessThanOrEqual(bounds?.[1][1] ?? 0)
  })
})
