import {
  HEAT_ROUTES,
  LANDMARKS,
  SHUTTLE_STOPS,
  WATER_POINTS,
  type HeatRoute,
  type HeatRouteSegment,
  type Landmark,
  type LandmarkId,
  type LatLng,
} from './heatroute-data'

export type HeatRouteOptions = {
  startId: LandmarkId
  endId: LandmarkId
  departure: Date
  mobilityMode: boolean
  includeShuttle: boolean
}

export type SunPosition = {
  altitudeDeg: number
  azimuthDeg: number
  intensity: number
}

export type SegmentEvaluation = HeatRouteSegment & {
  exposurePercent: number
}

export type EvaluatedRoute = HeatRoute & {
  durationMinutes: number
  distanceMeters: number
  exposurePercent: number
  exposedMinutes: number
  protectedMinutes: number
  waterStops: number
  shuttleWaitMinutes: number
  confidence: number
  score: number
  heatRisk: 'low' | 'moderate' | 'high' | 'extreme'
  reasons: string[]
  evaluatedSegments: SegmentEvaluation[]
}

const TEMPE_BOUNDS = {
  minLat: 33.414,
  maxLat: 33.428,
  minLng: -111.94,
  maxLng: -111.926,
}

const KIND_EXPOSURE_FACTOR: Record<HeatRouteSegment['kind'], number> = {
  sun: 1,
  shade: 0.48,
  covered: 0.22,
  indoor: 0.05,
  shuttle: 0.08,
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000)
}

/**
 * NOAA-style solar position approximation. Good enough for route comparison;
 * this is not used for safety-critical navigation.
 */
export function getSunPosition(date: Date, point: LatLng): SunPosition {
  const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear(date) - 1 + (minutes / 60 - 12) / 24)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  const timezoneOffsetMinutes = -date.getTimezoneOffset()
  const trueSolarTime = (minutes + eqTime + 4 * point.lng - timezoneOffsetMinutes + 1440) % 1440
  const hourAngle = toRad(trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180)
  const latRad = toRad(point.lat)
  const cosZenith =
    Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
  const zenith = Math.acos(clamp(cosZenith, -1, 1))
  const altitudeDeg = 90 - toDeg(zenith)
  const azimuthRad = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(decl) * Math.cos(latRad),
  )
  const azimuthDeg = (toDeg(azimuthRad) + 180) % 360
  const intensity = clamp(Math.sin(toRad(Math.max(0, altitudeDeg))) * 1.18, 0, 1)

  return { altitudeDeg, azimuthDeg, intensity }
}

function averagePoint(points: LatLng[]): LatLng {
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  }
}

function buildingShadowFactor(segment: HeatRouteSegment, sun: SunPosition) {
  if (segment.buildingShadow === 'none' || sun.altitudeDeg < 8) return 1
  if (segment.buildingShadow === 'morning' && sun.azimuthDeg < 160) return 0.72
  if (segment.buildingShadow === 'midday' && sun.altitudeDeg > 58) return 0.62
  if (segment.buildingShadow === 'afternoon' && sun.azimuthDeg > 205) return 0.7
  return 1
}

export function evaluateSegment(
  segment: HeatRouteSegment,
  departure: Date,
  mobilityMode: boolean,
): SegmentEvaluation {
  const sun = getSunPosition(departure, averagePoint(segment.path))
  const shadeFactor = 1 - clamp(segment.shadeCoverage, 0, 1) * 0.72
  const mobilityFactor =
    mobilityMode && (segment.kind === 'indoor' || segment.kind === 'covered') ? 0.85 : 1
  const exposurePercent = Math.round(
    clamp(
      sun.intensity *
        100 *
        KIND_EXPOSURE_FACTOR[segment.kind] *
        shadeFactor *
        buildingShadowFactor(segment, sun) *
        mobilityFactor,
      0,
      100,
    ),
  )

  return { ...segment, exposurePercent }
}

function uniqueCount(values: Array<string | undefined>) {
  return new Set(values.filter(Boolean)).size
}

function confidenceFor(route: HeatRoute) {
  const verified = new Date(`${route.lastVerified}T00:00:00`)
  const daysOld = Math.max(0, (Date.now() - verified.getTime()) / 86_400_000)
  const base = route.verificationLevel === 'campus-walk-review' ? 92 : 78
  const stalePenalty = daysOld > 180 ? 22 : daysOld > 90 ? 12 : daysOld > 30 ? 6 : 0
  const completeSegmentBonus = route.segments.every((s) => s.notes && s.path.length >= 2) ? 6 : 0
  return clamp(Math.round(base + completeSegmentBonus - stalePenalty), 35, 98)
}

export function evaluateRoute(
  route: HeatRoute,
  options: Omit<HeatRouteOptions, 'startId' | 'endId'>,
) {
  const evaluatedSegments = route.segments.map((segment) =>
    evaluateSegment(segment, options.departure, options.mobilityMode),
  )
  const durationMinutes = route.segments.reduce((sum, s) => sum + s.durationMinutes, 0)
  const distanceMeters = route.segments.reduce((sum, s) => sum + s.distanceMeters, 0)
  const weightedExposure =
    evaluatedSegments.reduce((sum, s) => sum + s.exposurePercent * s.durationMinutes, 0) /
    durationMinutes
  const exposurePercent = Math.round(weightedExposure)
  const exposedMinutes = Number(
    evaluatedSegments
      .reduce((sum, s) => sum + (s.exposurePercent / 100) * s.durationMinutes, 0)
      .toFixed(1),
  )
  const protectedMinutes = Number((durationMinutes - exposedMinutes).toFixed(1))
  const waterStops = uniqueCount(route.segments.flatMap((s) => s.waterRefs ?? []))
  const shuttleStopIds = route.segments.flatMap((s) => s.shuttleStopRefs ?? [])
  const shuttleWaitMinutes =
    route.strategy === 'shuttle'
      ? Math.max(
          ...shuttleStopIds.map((id) => SHUTTLE_STOPS.find((s) => s.id === id)?.etaMinutes ?? 0),
          0,
        )
      : 0
  const confidence = confidenceFor(route)
  const mobilityPenalty =
    options.mobilityMode && route.segments.some((s) => s.mobility === 'mixed') ? 18 : 0
  const waterBonus = Math.min(waterStops * 4, 8)
  const shuttlePenalty = route.strategy === 'shuttle' ? shuttleWaitMinutes * 0.55 : 0
  const score = Math.round(
    durationMinutes * 1.4 +
      exposurePercent * 1.15 +
      shuttlePenalty +
      mobilityPenalty -
      protectedMinutes * 0.3 -
      waterBonus -
      confidence * 0.08,
  )
  const heatRisk =
    exposurePercent >= 72
      ? 'extreme'
      : exposurePercent >= 55
        ? 'high'
        : exposurePercent >= 35
          ? 'moderate'
          : 'low'
  const reasons = [
    `${durationMinutes} min`,
    `${exposurePercent}% estimated sun`,
    `${protectedMinutes} protected min`,
    waterStops ? `${waterStops} water stop${waterStops > 1 ? 's' : ''}` : 'no mapped water stop',
  ]
  if (route.strategy === 'shuttle') reasons.push(`${shuttleWaitMinutes} min shuttle wait`)
  if (options.mobilityMode && mobilityPenalty === 0) reasons.push('mobility friendly')

  return {
    ...route,
    durationMinutes,
    distanceMeters,
    exposurePercent,
    exposedMinutes,
    protectedMinutes,
    waterStops,
    shuttleWaitMinutes,
    confidence,
    score,
    heatRisk,
    reasons,
    evaluatedSegments,
  } satisfies EvaluatedRoute
}

export function routesForJourney(options: HeatRouteOptions): EvaluatedRoute[] {
  return HEAT_ROUTES.filter((route) => {
    const sameJourney = route.startId === options.startId && route.endId === options.endId
    const allowedByShuttle = options.includeShuttle || route.strategy !== 'shuttle'
    return sameJourney && allowedByShuttle
  })
    .map((route) => evaluateRoute(route, options))
    .sort((a, b) => a.score - b.score)
}

export function availableDestinations(startId: LandmarkId): Landmark[] {
  const ids = new Set<LandmarkId>()
  for (const route of HEAT_ROUTES) {
    if (route.startId === startId) ids.add(route.endId)
  }
  return LANDMARKS.filter((landmark) => ids.has(landmark.id))
}

export function landmarkById(id: LandmarkId) {
  return LANDMARKS.find((landmark) => landmark.id === id)
}

export function projectPoint(point: LatLng) {
  const x = ((point.lng - TEMPE_BOUNDS.minLng) / (TEMPE_BOUNDS.maxLng - TEMPE_BOUNDS.minLng)) * 100
  const y = ((TEMPE_BOUNDS.maxLat - point.lat) / (TEMPE_BOUNDS.maxLat - TEMPE_BOUNDS.minLat)) * 100
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) }
}

export function pathToSvg(points: LatLng[]) {
  return points
    .map(projectPoint)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

export function validateHeatRouteData() {
  const errors: string[] = []
  const landmarkIds = new Set(LANDMARKS.map((l) => l.id))
  const waterIds = new Set(WATER_POINTS.map((w) => w.id))
  const shuttleIds = new Set(SHUTTLE_STOPS.map((s) => s.id))

  for (const route of HEAT_ROUTES) {
    if (!landmarkIds.has(route.startId)) errors.push(`${route.id}: unknown start ${route.startId}`)
    if (!landmarkIds.has(route.endId)) errors.push(`${route.id}: unknown end ${route.endId}`)
    if (!route.lastVerified) errors.push(`${route.id}: missing verification date`)
    if (route.sourceUrls.length === 0) errors.push(`${route.id}: missing source URL`)

    const totalDuration = route.segments.reduce((sum, s) => sum + s.durationMinutes, 0)
    if (totalDuration < 3 || totalDuration > 45) errors.push(`${route.id}: implausible duration`)

    for (const segment of route.segments) {
      if (segment.path.length < 2) errors.push(`${segment.id}: needs at least two coordinates`)
      if (segment.durationMinutes <= 0) errors.push(`${segment.id}: invalid duration`)
      if (segment.distanceMeters <= 0) errors.push(`${segment.id}: invalid distance`)
      if (!segment.notes) errors.push(`${segment.id}: missing notes`)
      for (const point of segment.path) {
        if (
          point.lat < TEMPE_BOUNDS.minLat ||
          point.lat > TEMPE_BOUNDS.maxLat ||
          point.lng < TEMPE_BOUNDS.minLng ||
          point.lng > TEMPE_BOUNDS.maxLng
        ) {
          errors.push(`${segment.id}: coordinate outside Tempe pilot bounds`)
        }
      }
      for (const id of segment.waterRefs ?? []) {
        if (!waterIds.has(id)) errors.push(`${segment.id}: unknown water ref ${id}`)
      }
      for (const id of segment.shuttleStopRefs ?? []) {
        if (!shuttleIds.has(id)) errors.push(`${segment.id}: unknown shuttle ref ${id}`)
      }
    }
  }

  return errors
}
