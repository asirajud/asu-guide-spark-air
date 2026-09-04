// Weather as a tool. Open-Meteo is free, keyless and carries no personal data;
// the service normalises its response into the small shape the chat card draws
// (current conditions + the next hours). Tempe is the default because this is a
// campus assistant, but any place a student names is resolved through
// Open-Meteo's geocoder, so "weather in San Francisco" is answered rather than
// deflected. node:http, no framework, like the other tool services. Nothing
// here calls a model.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

const PORT = Number(process.env.PORT ?? 5005)
/** ASU Tempe campus — the default when the student names no place. */
const TEMPE: Place = {
  lat: 33.4242,
  lng: -111.9281,
  label: 'ASU Tempe campus',
  tz: 'America/Phoenix',
}
const CACHE_MS = 5 * 60 * 1000
/** A named point Open-Meteo can forecast for. */
type Place = { lat: number; lng: number; label: string; tz: string }

function json(res: ServerResponse, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.writeHead(status)
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** WMO weather codes → a word and a glyph the card can show. */
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: 'sun' },
  1: { label: 'Mostly clear', icon: 'sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'rain' },
  53: { label: 'Drizzle', icon: 'rain' },
  55: { label: 'Drizzle', icon: 'rain' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  80: { label: 'Showers', icon: 'rain' },
  81: { label: 'Showers', icon: 'rain' },
  82: { label: 'Heavy showers', icon: 'rain' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm', icon: 'storm' },
  99: { label: 'Thunderstorm', icon: 'storm' },
}
const describe = (code: number) => WMO[code] ?? { label: 'Cloudy', icon: 'cloud' }

/** Plain-language heat guidance from the apparent temperature, in °F. */
function heatAdvice(feelsLike: number): {
  level: 'ok' | 'caution' | 'extreme' | 'danger'
  text: string
} {
  if (feelsLike >= 115)
    return {
      level: 'danger',
      text: 'Dangerous heat. Stay indoors; if you must walk, keep it short and shaded.',
    }
  if (feelsLike >= 105)
    return {
      level: 'extreme',
      text: 'Extreme heat. Prefer indoor routes, carry water, avoid midday.',
    }
  if (feelsLike >= 95)
    return { level: 'caution', text: 'Hot. Shade and water on any walk over ten minutes.' }
  return { level: 'ok', text: 'Comfortable for walking.' }
}

/**
 * Resolve a student's words into a point. Open-Meteo's geocoder is keyless and
 * takes plain names ("San Francisco", "Tempe AZ", "Barcelona"). Resolutions are
 * cached for the process lifetime: place names do not move.
 */
const placeCache = new Map<string, Place | null>()

async function resolvePlace(query: string): Promise<Place | null> {
  const key = query.trim().toLowerCase()
  if (!key) return TEMPE
  const hit = placeCache.get(key)
  if (hit !== undefined) return hit

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({
    name: query.trim(),
    count: '1',
    language: 'en',
    format: 'json',
  }).toString()

  let place: Place | null = null
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (res.ok) {
    const j = (await res.json()) as {
      results?: {
        name: string
        latitude: number
        longitude: number
        timezone: string
        admin1?: string
        country_code?: string
      }[]
    }
    const top = j.results?.[0]
    if (top) {
      // "San Francisco, California, US" reads better than a bare city name and
      // makes a wrong match obvious to the student instead of silent.
      const label = [top.name, top.admin1, top.country_code].filter(Boolean).join(', ')
      place = {
        lat: top.latitude,
        lng: top.longitude,
        label,
        tz: top.timezone || 'UTC',
      }
    }
  }
  placeCache.set(key, place)
  return place
}

type Forecast = {
  kind: 'weather'
  place: string
  timezone: string
  fetchedAt: string
  current: {
    time: string
    tempF: number
    feelsLikeF: number
    humidity: number
    uv: number
    windMph: number
    condition: string
    icon: string
    isDay: boolean
  }
  hourly: {
    time: string
    tempF: number
    feelsLikeF: number
    precipPct: number
    uv: number
    windMph: number
    condition: string
    icon: string
  }[]
  today: { highF: number; lowF: number; uvMax: number; sunrise: string; sunset: string }
  advice: { level: string; text: string }
  source: 'Open-Meteo'
}

/** Keyed by place, so asking about two cities in one thread does not thrash. */
const cache = new Map<string, { at: number; data: Forecast }>()

async function fetchForecast(place: Place): Promise<Forecast> {
  const cacheKey = `${place.lat.toFixed(3)},${place.lng.toFixed(3)}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lng),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,uv_index,wind_speed_10m,weather_code,is_day',
    hourly:
      'temperature_2m,apparent_temperature,precipitation_probability,uv_index,wind_speed_10m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: place.tz,
    forecast_days: '2',
  }).toString()
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const j = (await res.json()) as {
    current: Record<string, number>
    hourly: Record<string, (number | string)[]>
    daily: Record<string, (number | string)[]>
  }
  const c = j.current
  const cur = describe(c.weather_code)
  // Hours from the current hour forward, 18 of them.
  const nowIdx = (j.hourly.time as string[]).findIndex(
    (t) => t >= (c.time as unknown as string).slice(0, 13),
  )
  const start = Math.max(0, nowIdx)
  const hourly = (j.hourly.time as string[]).slice(start, start + 18).map((time, k) => {
    const i = start + k
    const d = describe(Number(j.hourly.weather_code[i]))
    return {
      time,
      tempF: Math.round(Number(j.hourly.temperature_2m[i])),
      feelsLikeF: Math.round(Number(j.hourly.apparent_temperature[i])),
      precipPct: Math.round(Number(j.hourly.precipitation_probability[i] ?? 0)),
      uv: Math.round(Number(j.hourly.uv_index[i] ?? 0) * 10) / 10,
      windMph: Math.round(Number(j.hourly.wind_speed_10m[i])),
      condition: d.label,
      icon: d.icon,
    }
  })
  const data: Forecast = {
    kind: 'weather',
    place: place.label,
    timezone: place.tz,
    fetchedAt: new Date().toISOString(),
    current: {
      time: c.time as unknown as string,
      tempF: Math.round(c.temperature_2m),
      feelsLikeF: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      uv: Math.round(c.uv_index * 10) / 10,
      windMph: Math.round(c.wind_speed_10m),
      condition: cur.label,
      icon: cur.icon,
      isDay: c.is_day === 1,
    },
    hourly,
    today: {
      highF: Math.round(Number(j.daily.temperature_2m_max[0])),
      lowF: Math.round(Number(j.daily.temperature_2m_min[0])),
      uvMax: Math.round(Number(j.daily.uv_index_max[0]) * 10) / 10,
      sunrise: String(j.daily.sunrise[0]),
      sunset: String(j.daily.sunset[0]),
    },
    advice: heatAdvice(Math.round(c.apparent_temperature)),
    source: 'Open-Meteo',
  }
  cache.set(cacheKey, { at: Date.now(), data })
  return data
}

/** The tool contract this service publishes to asu-tools-api. */
export const TOOLS = [
  {
    name: 'get_weather',
    description:
      'Current conditions and an hourly forecast: temperature, feels-like, humidity, UV, wind, chance of rain, sunrise and sunset, plus plain heat guidance. Defaults to the ASU Tempe campus, so leave place out for anything on campus. Pass place when the student names somewhere else ("San Francisco", "Barcelona", their home town) and it is resolved by name. Call it when a student asks about the weather, the heat, whether to walk or wait, what to wear, or when it cools down. The hourly strip is drawn for them automatically, so summarise rather than list every hour. Source: Open-Meteo; no key, no personal data.',
    inputSchema: {
      type: 'object',
      properties: {
        place: {
          type: 'string',
          minLength: 2,
          maxLength: 80,
          description:
            "A city, town or landmark in the student's own words. Omit for the ASU Tempe campus.",
        },
        hours: {
          type: 'integer',
          minimum: 1,
          maximum: 18,
          description: 'How many hours ahead to return. Default 12.',
        },
      },
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
      service: 'asu-weather-api',
      place: TEMPE.label,
      tools: TOOLS.map((t) => t.name),
    })
  }
  if (req.method === 'GET' && url.pathname === '/tools') return json(res, 200, { tools: TOOLS })

  if ((req.method === 'POST' || req.method === 'GET') && url.pathname === '/weather') {
    let hours = 12
    let query = ''
    try {
      const body =
        req.method === 'POST' ? ((await readJson(req)) as { hours?: unknown; place?: unknown }) : {}
      const h = Number(body.hours ?? url.searchParams.get('hours') ?? 12)
      if (Number.isFinite(h)) hours = Math.min(18, Math.max(1, Math.round(h)))
      const p = body.place ?? url.searchParams.get('place') ?? ''
      if (typeof p === 'string') query = p.slice(0, 80)
    } catch {
      return json(res, 400, { error: 'Expected a JSON body.' })
    }
    try {
      // A name we cannot resolve is a structured answer, not a 502: the model
      // relays "I could not find that place" instead of inventing a forecast.
      const place = query ? await resolvePlace(query) : TEMPE
      if (!place) {
        return json(res, 404, {
          error: `No place called "${query}" was found.`,
          hint: 'Try a city or town name. Leave place out for the ASU Tempe campus.',
        })
      }
      const f = await fetchForecast(place)
      return json(res, 200, { ...f, hourly: f.hourly.slice(0, hours) })
    } catch (err) {
      console.error('[weather]', err instanceof Error ? err.message : err)
      return json(res, 502, { error: 'Weather is unavailable right now.' })
    }
  }
  json(res, 404, { error: 'Not found.' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`asu-weather-api listening on http://127.0.0.1:${PORT}`)
})
