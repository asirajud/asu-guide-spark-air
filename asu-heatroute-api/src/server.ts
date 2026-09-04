// HeatRoute as a tool. The engine and the curated Tempe data live in
// asu-guide/src/lib (they are pure TypeScript with no React in them); this
// service imports them directly rather than copying 600 lines, so the page and
// the tool can never disagree about a route. node:http, mirroring
// asu-search-api: three routes, no framework.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { LANDMARKS, type LandmarkId } from '../../asu-guide/src/lib/heatroute-data.ts'
import {
  availableDestinations,
  getSunPosition,
  landmarkById,
  routesForJourney,
  type EvaluatedRoute,
} from '../../asu-guide/src/lib/heatroute-engine.ts'

const PORT = Number(process.env.PORT ?? 5014)

function json(res: ServerResponse, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.writeHead(status)
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 50_000) throw new Error('request body too large')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Students say "the MU" or "Hayden", not landmark ids. Resolution is
 * deterministic — aliases first, then token overlap against the label — so the
 * same phrase always lands on the same place, and an unknown one comes back as
 * a structured error listing what IS known, which the model can act on.
 */
const ALIASES: Record<string, LandmarkId> = {
  mu: 'memorial-union',
  'memorial union': 'memorial-union',
  union: 'memorial-union',
  hayden: 'hayden-library',
  'hayden library': 'hayden-library',
  tooker: 'tooker-house',
  'tooker house': 'tooker-house',
  coor: 'coor-hall',
  'coor hall': 'coor-hall',
  noble: 'noble-library',
  'noble library': 'noble-library',
  'student services': 'student-services',
  ssv: 'student-services',
  sdfc: 'sun-devil-fitness',
  fitness: 'sun-devil-fitness',
  gym: 'sun-devil-fitness',
  'sun devil fitness': 'sun-devil-fitness',
  'lot 59': 'lot-59',
  arena: 'lot-59',
  'desert financial arena': 'lot-59',
}

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolveLandmark(text: string): LandmarkId | null {
  const q = norm(text)
  if (!q) return null
  const byId = LANDMARKS.find((l) => l.id === q.replace(/ /g, '-'))
  if (byId) return byId.id
  if (ALIASES[q]) return ALIASES[q]
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (q.includes(alias)) return id
  }
  const qTokens = new Set(q.split(' '))
  let best: { id: LandmarkId; score: number } | null = null
  for (const l of LANDMARKS) {
    const tokens = norm(l.label).split(' ')
    const score = tokens.filter((t) => qTokens.has(t) && t.length > 2).length / tokens.length
    if (score > 0 && (!best || score > best.score)) best = { id: l.id, score }
  }
  return best && best.score >= 0.34 ? best.id : null
}

function parseDeparture(value: unknown): Date {
  if (typeof value !== 'string' || !value.trim()) return new Date()
  const v = value.trim()
  // "14:30" → today at that time, in this machine's local zone (Phoenix on the demo box).
  const hm = /^(\d{1,2}):(\d{2})$/.exec(v)
  if (hm) {
    const d = new Date()
    d.setHours(Number(hm[1]), Number(hm[2]), 0, 0)
    return d
  }
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function summarise(route: EvaluatedRoute) {
  return {
    id: route.id,
    label: route.label,
    strategy: route.strategy,
    description: route.description,
    durationMinutes: route.durationMinutes,
    distanceMeters: route.distanceMeters,
    exposurePercent: route.exposurePercent,
    exposedMinutes: route.exposedMinutes,
    protectedMinutes: route.protectedMinutes,
    waterStops: route.waterStops,
    shuttleWaitMinutes: route.shuttleWaitMinutes,
    heatRisk: route.heatRisk,
    confidence: route.confidence,
    reasons: route.reasons,
    segments: route.evaluatedSegments.map((s) => ({
      label: s.label,
      kind: s.kind,
      durationMinutes: s.durationMinutes,
      exposurePercent: s.exposurePercent,
      notes: s.notes,
    })),
  }
}

const KNOWN = LANDMARKS.map((l) => l.label)

/** The tool contract this service publishes to asu-tools-api. */
export const TOOLS = [
  {
    name: 'plan_heat_route',
    description:
      'Plan a heat-aware walking route between two Tempe campus landmarks (Memorial Union, Hayden Library, Tooker House, Coor Hall, Noble Library, Student Services, Sun Devil Fitness Complex, Lot 59). Returns ranked route options scored on estimated sun exposure, shade, water stops and shuttle use for the departure time. Call it whenever a student asks how to get somewhere on campus, how to avoid the heat or sun on a walk, or where shade or water is on the way. Estimates from pilot data, not turn-by-turn navigation. Pilot coverage today: Memorial Union ↔ Hayden Library, Tooker House → Coor Hall, Lot 59 → Memorial Union, Student Services → Noble Library, Noble Library → Sun Devil Fitness; other pairs return a structured “no route yet” error listing what is reachable.',
    inputSchema: {
      type: 'object',
      properties: {
        start: {
          type: 'string',
          minLength: 2,
          description: "Where the student starts, in their words — e.g. 'the MU', 'Hayden'.",
        },
        destination: {
          type: 'string',
          minLength: 2,
          description: 'Where they are going, in their words.',
        },
        departure: {
          type: 'string',
          description: "When they leave: an ISO datetime or 'HH:MM' today. Defaults to now.",
        },
        mobility: {
          type: 'boolean',
          description: 'True if the student needs step-free / indoor or covered segments.',
        },
        shuttle: {
          type: 'boolean',
          description: 'Whether shuttle routes may be included. Defaults to true.',
        },
      },
      required: ['start', 'destination'],
      additionalProperties: false,
    },
  },
]

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.writeHead(204)
    return res.end()
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'asu-heatroute-api',
      landmarks: LANDMARKS.length,
      tools: TOOLS.map((t) => t.name),
    })
  }

  if (req.method === 'GET' && url.pathname === '/tools') {
    return json(res, 200, { tools: TOOLS })
  }

  if (req.method === 'GET' && url.pathname === '/landmarks') {
    return json(res, 200, { landmarks: LANDMARKS.map((l) => ({ id: l.id, label: l.label })) })
  }

  if (req.method === 'POST' && url.pathname === '/route') {
    let body: {
      start?: unknown
      destination?: unknown
      departure?: unknown
      mobility?: unknown
      shuttle?: unknown
    }
    try {
      body = (await readJson(req)) as typeof body
    } catch {
      return json(res, 400, { error: 'Expected a JSON body.' })
    }

    const startId = typeof body.start === 'string' ? resolveLandmark(body.start) : null
    const endId = typeof body.destination === 'string' ? resolveLandmark(body.destination) : null
    if (!startId || !endId) {
      return json(res, 400, {
        error: `Unknown ${!startId ? 'start' : 'destination'}. HeatRoute knows these places: ${KNOWN.join(', ')}.`,
        field: !startId ? 'start' : 'destination',
        knownLandmarks: KNOWN,
      })
    }
    if (startId === endId) {
      return json(res, 400, {
        error: 'Start and destination are the same place.',
        field: 'destination',
      })
    }
    if (!availableDestinations(startId).some((l) => l.id === endId)) {
      const reachable = availableDestinations(startId).map((l) => l.label)
      return json(res, 400, {
        error: `No curated route from ${landmarkById(startId)?.label} to ${landmarkById(endId)?.label} yet. From there HeatRoute has routes to: ${reachable.join(', ')}.`,
        field: 'destination',
        reachable,
      })
    }

    const departure = parseDeparture(body.departure)
    const mobilityMode = body.mobility === true
    const includeShuttle = body.shuttle !== false
    const started = Date.now()
    const routes = routesForJourney({ startId, endId, departure, mobilityMode, includeShuttle })
    const start = landmarkById(startId)!
    const sun = getSunPosition(departure, start)

    return json(res, 200, {
      kind: 'heatroute',
      start: { id: startId, label: start.label },
      destination: { id: endId, label: landmarkById(endId)!.label },
      departureIso: departure.toISOString(),
      mobilityMode,
      includeShuttle,
      sun: {
        altitudeDeg: Math.round(sun.altitudeDeg),
        azimuthDeg: Math.round(sun.azimuthDeg),
        intensity: Math.round(sun.intensity * 100),
      },
      recommendedId: routes[0]?.id ?? null,
      routes: routes.map(summarise),
      note: 'Estimates from pilot data; corridors are approximate, not turn-by-turn navigation.',
      ms: Date.now() - started,
    })
  }

  json(res, 404, { error: 'Not found.' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`asu-heatroute-api listening on http://127.0.0.1:${PORT}`)
})
