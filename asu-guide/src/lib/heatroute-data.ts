export type LandmarkId =
  | 'memorial-union'
  | 'hayden-library'
  | 'tooker-house'
  | 'coor-hall'
  | 'noble-library'
  | 'student-services'
  | 'sun-devil-fitness'
  | 'lot-59'

export type SegmentKind = 'sun' | 'shade' | 'indoor' | 'covered' | 'shuttle'
export type MobilityLevel = 'step-free' | 'mostly-step-free' | 'mixed'
export type VerificationLevel = 'public-map-review' | 'campus-walk-review'

export type LatLng = {
  lat: number
  lng: number
}

export type Landmark = LatLng & {
  id: LandmarkId
  label: string
  shortLabel: string
  sourceUrl: string
}

export type HeatRouteSegment = {
  id: string
  label: string
  kind: SegmentKind
  path: LatLng[]
  durationMinutes: number
  distanceMeters: number
  shadeCoverage: number
  buildingShadow: 'morning' | 'midday' | 'afternoon' | 'none'
  mobility: MobilityLevel
  notes: string
  waterRefs?: string[]
  shuttleStopRefs?: string[]
}

export type HeatRoute = {
  id: string
  startId: LandmarkId
  endId: LandmarkId
  label: string
  description: string
  strategy: 'fastest' | 'shade' | 'indoor' | 'shuttle'
  sourceUrls: string[]
  lastVerified: string
  verificationLevel: VerificationLevel
  verificationNotes: string
  segments: HeatRouteSegment[]
}

export type WaterPoint = LatLng & {
  id: string
  label: string
  landmarkId: LandmarkId
  sourceUrl: string
}

export type ShuttleStop = LatLng & {
  id: string
  label: string
  etaMinutes: number
  sourceUrl: string
  note: string
}

export const HEATROUTE_SOURCES = {
  asuMap: 'https://www.asu.edu/map/interactive/',
  muDirections: 'https://eoss.asu.edu/mu/about/directions',
  haydenLibrary: 'https://lib.asu.edu/locations/hayden',
  coorHall: 'https://tours.asu.edu/tempe/lattie-f-coor-hall',
  tookerHouse: 'https://sundevilcentral.eoss.asu.edu/tooker/contact-us/',
  shuttles: 'https://cfo.asu.edu/shuttles',
  shuttleTracker: 'https://asu-shuttles.rider.peaktransit.com/',
  waterLayer:
    'https://gis.m.asu.edu/server/rest/services/Campus/CampusServices06022023/FeatureServer/15',
} as const

export const LANDMARKS: Landmark[] = [
  {
    id: 'memorial-union',
    label: 'Memorial Union',
    shortLabel: 'MU',
    lat: 33.4178,
    lng: -111.9344,
    sourceUrl: HEATROUTE_SOURCES.muDirections,
  },
  {
    id: 'hayden-library',
    label: 'Hayden Library',
    shortLabel: 'Hayden',
    lat: 33.4184,
    lng: -111.9341,
    sourceUrl: HEATROUTE_SOURCES.haydenLibrary,
  },
  {
    id: 'tooker-house',
    label: 'Tooker House',
    shortLabel: 'Tooker',
    lat: 33.4218,
    lng: -111.9289,
    sourceUrl: HEATROUTE_SOURCES.tookerHouse,
  },
  {
    id: 'coor-hall',
    label: 'Lattie F. Coor Hall',
    shortLabel: 'COOR',
    lat: 33.4198,
    lng: -111.9362,
    sourceUrl: HEATROUTE_SOURCES.coorHall,
  },
  {
    id: 'noble-library',
    label: 'Noble Library',
    shortLabel: 'Noble',
    lat: 33.4197,
    lng: -111.9288,
    sourceUrl: HEATROUTE_SOURCES.asuMap,
  },
  {
    id: 'student-services',
    label: 'Student Services',
    shortLabel: 'SSV',
    lat: 33.4168,
    lng: -111.9368,
    sourceUrl: HEATROUTE_SOURCES.asuMap,
  },
  {
    id: 'sun-devil-fitness',
    label: 'Sun Devil Fitness Complex',
    shortLabel: 'SDFC',
    lat: 33.4187,
    lng: -111.9303,
    sourceUrl: HEATROUTE_SOURCES.asuMap,
  },
  {
    id: 'lot-59',
    label: 'Lot 59 / Desert Financial Arena',
    shortLabel: 'Lot 59',
    lat: 33.4262,
    lng: -111.9304,
    sourceUrl: HEATROUTE_SOURCES.asuMap,
  },
]

export const WATER_POINTS: WaterPoint[] = [
  {
    id: 'water-mu',
    label: 'MU bottle filling station',
    landmarkId: 'memorial-union',
    lat: 33.4178,
    lng: -111.9344,
    sourceUrl: HEATROUTE_SOURCES.waterLayer,
  },
  {
    id: 'water-hayden',
    label: 'Hayden Library bottle filling station',
    landmarkId: 'hayden-library',
    lat: 33.4184,
    lng: -111.9341,
    sourceUrl: HEATROUTE_SOURCES.waterLayer,
  },
  {
    id: 'water-noble',
    label: 'Noble Library bottle filling station',
    landmarkId: 'noble-library',
    lat: 33.4197,
    lng: -111.9288,
    sourceUrl: HEATROUTE_SOURCES.waterLayer,
  },
  {
    id: 'water-sdfc',
    label: 'SDFC bottle filling station',
    landmarkId: 'sun-devil-fitness',
    lat: 33.4187,
    lng: -111.9303,
    sourceUrl: HEATROUTE_SOURCES.waterLayer,
  },
]

export const SHUTTLE_STOPS: ShuttleStop[] = [
  {
    id: 'stop-mu',
    label: 'MU / Orange Mall stop',
    lat: 33.4179,
    lng: -111.9349,
    etaMinutes: 7,
    sourceUrl: HEATROUTE_SOURCES.shuttleTracker,
    note: 'Static pilot ETA; official tracker should be checked before relying on it.',
  },
  {
    id: 'stop-lot-59',
    label: 'Lot 59 shuttle stop',
    lat: 33.4256,
    lng: -111.9305,
    etaMinutes: 9,
    sourceUrl: HEATROUTE_SOURCES.shuttleTracker,
    note: 'Static pilot ETA; ASU notes exact shuttle times are not guaranteed.',
  },
  {
    id: 'stop-tooker',
    label: 'Tooker / University stop',
    lat: 33.4218,
    lng: -111.9294,
    etaMinutes: 6,
    sourceUrl: HEATROUTE_SOURCES.shuttleTracker,
    note: 'Static pilot ETA for demo routing.',
  },
]

const p = (lat: number, lng: number): LatLng => ({ lat, lng })

export const HEAT_ROUTES: HeatRoute[] = [
  {
    id: 'mu-hayden-direct',
    startId: 'memorial-union',
    endId: 'hayden-library',
    label: 'Direct walk',
    description: 'Fastest northbound walk across Orange Mall with the most open sky.',
    strategy: 'fastest',
    sourceUrls: [HEATROUTE_SOURCES.muDirections, HEATROUTE_SOURCES.haydenLibrary],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Landmarks checked against ASU public pages; shade estimate is pilot data.',
    segments: [
      {
        id: 'mu-hayden-direct-1',
        label: 'MU north plaza',
        kind: 'sun',
        path: [p(33.4178, -111.9344), p(33.418, -111.93435), p(33.41818, -111.93425)],
        durationMinutes: 5,
        distanceMeters: 250,
        shadeCoverage: 0.18,
        buildingShadow: 'morning',
        mobility: 'step-free',
        notes: 'Wide open plaza; shade changes sharply after noon.',
        waterRefs: ['water-mu'],
      },
      {
        id: 'mu-hayden-direct-2',
        label: 'Orange Mall crossing',
        kind: 'sun',
        path: [p(33.41818, -111.93425), p(33.4183, -111.93418), p(33.4184, -111.9341)],
        durationMinutes: 8,
        distanceMeters: 380,
        shadeCoverage: 0.12,
        buildingShadow: 'afternoon',
        mobility: 'mostly-step-free',
        notes: 'Fastest route; least forgiving in direct sun.',
        waterRefs: ['water-hayden'],
      },
    ],
  },
  {
    id: 'mu-hayden-shade',
    startId: 'memorial-union',
    endId: 'hayden-library',
    label: 'Shade preferred',
    description: 'Adds a short detour to catch building shadow and tree cover.',
    strategy: 'shade',
    sourceUrls: [HEATROUTE_SOURCES.asuMap, HEATROUTE_SOURCES.haydenLibrary],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Pilot route follows mapped landmarks and manually tagged cover segments.',
    segments: [
      {
        id: 'mu-hayden-shade-1',
        label: 'MU interior edge',
        kind: 'covered',
        path: [p(33.4178, -111.9344), p(33.41795, -111.93455), p(33.41808, -111.93452)],
        durationMinutes: 4,
        distanceMeters: 190,
        shadeCoverage: 0.82,
        buildingShadow: 'midday',
        mobility: 'step-free',
        notes: 'Uses covered edges near the MU before turning north.',
        waterRefs: ['water-mu'],
      },
      {
        id: 'mu-hayden-shade-2',
        label: 'Tree-lined detour',
        kind: 'shade',
        path: [p(33.41808, -111.93452), p(33.41828, -111.93442), p(33.41845, -111.93425)],
        durationMinutes: 7,
        distanceMeters: 360,
        shadeCoverage: 0.62,
        buildingShadow: 'afternoon',
        mobility: 'mostly-step-free',
        notes: 'Trades a few minutes for intermittent tree and building shade.',
      },
      {
        id: 'mu-hayden-shade-3',
        label: 'Hayden entry',
        kind: 'shade',
        path: [p(33.41845, -111.93425), p(33.4184, -111.9341)],
        durationMinutes: 5,
        distanceMeters: 210,
        shadeCoverage: 0.58,
        buildingShadow: 'morning',
        mobility: 'step-free',
        notes: 'Finishes near the Hayden entrance and refill point.',
        waterRefs: ['water-hayden'],
      },
    ],
  },
  {
    id: 'mu-hayden-indoor',
    startId: 'memorial-union',
    endId: 'hayden-library',
    label: 'Indoor / covered',
    description: 'Maximizes indoor and covered time for heat-sensitive students.',
    strategy: 'indoor',
    sourceUrls: [HEATROUTE_SOURCES.asuMap, HEATROUTE_SOURCES.waterLayer],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Indoor connectors are pilot metadata and should be campus-walk verified.',
    segments: [
      {
        id: 'mu-hayden-indoor-1',
        label: 'MU interior connector',
        kind: 'indoor',
        path: [p(33.4178, -111.9344), p(33.41798, -111.93438)],
        durationMinutes: 6,
        distanceMeters: 240,
        shadeCoverage: 1,
        buildingShadow: 'none',
        mobility: 'step-free',
        notes: 'Lowest exposure segment; depends on building access hours.',
        waterRefs: ['water-mu'],
      },
      {
        id: 'mu-hayden-indoor-2',
        label: 'Covered library approach',
        kind: 'covered',
        path: [p(33.41798, -111.93438), p(33.4182, -111.9342), p(33.4184, -111.9341)],
        durationMinutes: 12,
        distanceMeters: 470,
        shadeCoverage: 0.88,
        buildingShadow: 'midday',
        mobility: 'step-free',
        notes: 'Slowest walk-only option but lowest estimated exposure.',
        waterRefs: ['water-hayden'],
      },
    ],
  },
  {
    id: 'tooker-coor-direct',
    startId: 'tooker-house',
    endId: 'coor-hall',
    label: 'Forest Mall direct',
    description: 'Fast route from Tooker toward COOR with long exposed stretches.',
    strategy: 'fastest',
    sourceUrls: [HEATROUTE_SOURCES.tookerHouse, HEATROUTE_SOURCES.coorHall],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Addresses verified from ASU pages; cover is pilot metadata.',
    segments: [
      {
        id: 'tooker-coor-direct-1',
        label: 'University Drive crossing',
        kind: 'sun',
        path: [p(33.4218, -111.9289), p(33.421, -111.9308), p(33.4203, -111.9328)],
        durationMinutes: 9,
        distanceMeters: 620,
        shadeCoverage: 0.2,
        buildingShadow: 'morning',
        mobility: 'mostly-step-free',
        notes: 'Open crossing and long sun exposure.',
      },
      {
        id: 'tooker-coor-direct-2',
        label: 'COOR approach',
        kind: 'shade',
        path: [p(33.4203, -111.9328), p(33.4198, -111.9362)],
        durationMinutes: 6,
        distanceMeters: 430,
        shadeCoverage: 0.46,
        buildingShadow: 'afternoon',
        mobility: 'step-free',
        notes: 'More building shadow close to COOR.',
      },
    ],
  },
  {
    id: 'tooker-coor-shade',
    startId: 'tooker-house',
    endId: 'coor-hall',
    label: 'Shade / Noble detour',
    description: 'Uses library-side cover before crossing west toward COOR.',
    strategy: 'shade',
    sourceUrls: [HEATROUTE_SOURCES.asuMap, HEATROUTE_SOURCES.waterLayer],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Designed around public landmark positions and tagged shade segments.',
    segments: [
      {
        id: 'tooker-coor-shade-1',
        label: 'Tooker to Noble',
        kind: 'shade',
        path: [p(33.4218, -111.9289), p(33.4212, -111.929), p(33.4197, -111.9288)],
        durationMinutes: 7,
        distanceMeters: 420,
        shadeCoverage: 0.55,
        buildingShadow: 'midday',
        mobility: 'step-free',
        notes: 'Library-side route with a refill point nearby.',
        waterRefs: ['water-noble'],
      },
      {
        id: 'tooker-coor-shade-2',
        label: 'Noble to COOR',
        kind: 'covered',
        path: [p(33.4197, -111.9288), p(33.4199, -111.932), p(33.4198, -111.9362)],
        durationMinutes: 11,
        distanceMeters: 610,
        shadeCoverage: 0.7,
        buildingShadow: 'afternoon',
        mobility: 'step-free',
        notes: 'Longer but better protected at peak sun.',
      },
    ],
  },
  {
    id: 'lot59-mu-direct',
    startId: 'lot-59',
    endId: 'memorial-union',
    label: 'Direct from Lot 59',
    description: 'Fastest walk from parking toward the MU.',
    strategy: 'fastest',
    sourceUrls: [HEATROUTE_SOURCES.asuMap, HEATROUTE_SOURCES.muDirections],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Parking node and MU source checked; path cover is pilot metadata.',
    segments: [
      {
        id: 'lot59-mu-direct-1',
        label: 'Lot 59 south edge',
        kind: 'sun',
        path: [p(33.4262, -111.9304), p(33.4235, -111.931), p(33.421, -111.9322)],
        durationMinutes: 9,
        distanceMeters: 720,
        shadeCoverage: 0.1,
        buildingShadow: 'none',
        mobility: 'mostly-step-free',
        notes: 'Open parking and stadium edge; high heat load.',
        shuttleStopRefs: ['stop-lot-59'],
      },
      {
        id: 'lot59-mu-direct-2',
        label: 'Mall approach',
        kind: 'shade',
        path: [p(33.421, -111.9322), p(33.4192, -111.9333), p(33.4178, -111.9344)],
        durationMinutes: 7,
        distanceMeters: 560,
        shadeCoverage: 0.38,
        buildingShadow: 'afternoon',
        mobility: 'step-free',
        notes: 'Some shade returns closer to central campus.',
        waterRefs: ['water-mu'],
      },
    ],
  },
  {
    id: 'lot59-mu-shuttle',
    startId: 'lot-59',
    endId: 'memorial-union',
    label: 'Shuttle assisted',
    description: 'Reduces walking exposure by waiting for the campus shuttle.',
    strategy: 'shuttle',
    sourceUrls: [HEATROUTE_SOURCES.shuttles, HEATROUTE_SOURCES.shuttleTracker],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Uses ASU shuttle pages and static pilot ETA metadata.',
    segments: [
      {
        id: 'lot59-mu-shuttle-1',
        label: 'Walk to Lot 59 stop',
        kind: 'sun',
        path: [p(33.4262, -111.9304), p(33.4256, -111.9305)],
        durationMinutes: 3,
        distanceMeters: 180,
        shadeCoverage: 0.08,
        buildingShadow: 'none',
        mobility: 'step-free',
        notes: 'Short exposed walk to the shuttle stop.',
        shuttleStopRefs: ['stop-lot-59'],
      },
      {
        id: 'lot59-mu-shuttle-2',
        label: 'Campus shuttle',
        kind: 'shuttle',
        path: [p(33.4256, -111.9305), p(33.4225, -111.932), p(33.4179, -111.9349)],
        durationMinutes: 12,
        distanceMeters: 1050,
        shadeCoverage: 1,
        buildingShadow: 'none',
        mobility: 'step-free',
        notes: 'Includes static 9 minute wait plus short in-vehicle travel.',
        shuttleStopRefs: ['stop-lot-59', 'stop-mu'],
      },
      {
        id: 'lot59-mu-shuttle-3',
        label: 'MU stop to entrance',
        kind: 'covered',
        path: [p(33.4179, -111.9349), p(33.4178, -111.9344)],
        durationMinutes: 3,
        distanceMeters: 160,
        shadeCoverage: 0.72,
        buildingShadow: 'midday',
        mobility: 'step-free',
        notes: 'Covered final approach to the MU.',
        waterRefs: ['water-mu'],
      },
    ],
  },
  {
    id: 'student-services-noble-shade',
    startId: 'student-services',
    endId: 'noble-library',
    label: 'Library shade line',
    description: 'Cross-campus option that prioritizes water access and tree cover.',
    strategy: 'shade',
    sourceUrls: [HEATROUTE_SOURCES.asuMap, HEATROUTE_SOURCES.waterLayer],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Pilot shade route between official landmark references.',
    segments: [
      {
        id: 'ssv-noble-1',
        label: 'Student Services Lawn',
        kind: 'shade',
        path: [p(33.4168, -111.9368), p(33.4176, -111.9348), p(33.4184, -111.9326)],
        durationMinutes: 8,
        distanceMeters: 620,
        shadeCoverage: 0.5,
        buildingShadow: 'afternoon',
        mobility: 'mixed',
        notes: 'Tree-lined but some narrow/crowded sections.',
      },
      {
        id: 'ssv-noble-2',
        label: 'Noble approach',
        kind: 'covered',
        path: [p(33.4184, -111.9326), p(33.4191, -111.9304), p(33.4197, -111.9288)],
        durationMinutes: 7,
        distanceMeters: 510,
        shadeCoverage: 0.72,
        buildingShadow: 'midday',
        mobility: 'step-free',
        notes: 'Good protected approach with water at Noble.',
        waterRefs: ['water-noble'],
      },
    ],
  },
  {
    id: 'noble-sdfc-water',
    startId: 'noble-library',
    endId: 'sun-devil-fitness',
    label: 'Water stop route',
    description: 'Short east-campus walk with water access at both ends.',
    strategy: 'shade',
    sourceUrls: [HEATROUTE_SOURCES.asuMap, HEATROUTE_SOURCES.waterLayer],
    lastVerified: '2026-09-03',
    verificationLevel: 'public-map-review',
    verificationNotes: 'Uses official water layer references and landmark positions.',
    segments: [
      {
        id: 'noble-sdfc-1',
        label: 'Noble east exit',
        kind: 'covered',
        path: [p(33.4197, -111.9288), p(33.4194, -111.9292), p(33.4191, -111.9297)],
        durationMinutes: 4,
        distanceMeters: 260,
        shadeCoverage: 0.68,
        buildingShadow: 'morning',
        mobility: 'step-free',
        notes: 'Protected exit with a water refill nearby.',
        waterRefs: ['water-noble'],
      },
      {
        id: 'noble-sdfc-2',
        label: 'Fitness approach',
        kind: 'shade',
        path: [p(33.4191, -111.9297), p(33.4187, -111.9303)],
        durationMinutes: 5,
        distanceMeters: 340,
        shadeCoverage: 0.48,
        buildingShadow: 'afternoon',
        mobility: 'step-free',
        notes: 'Short final segment to SDFC and another refill point.',
        waterRefs: ['water-sdfc'],
      },
    ],
  },
]
