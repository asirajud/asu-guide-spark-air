import 'server-only'

import { db } from '@/db'
import { modelHealth } from '@/db/schema'
import { AIR_BASE, DISABLE_TTL_MS, MODELS, type AirService } from './models'

/**
 * Raised when a model itself is unusable — the gateway does not know it, it has
 * no deployment, or it cannot handle this modality. The runner benches the model
 * and moves to the next one.
 *
 * Slowness, cold starts, timeouts, 429s and 5xx are NOT this. A model that is
 * merely slow is still correct, and benching it for a day would be wrong.
 */
export class ModelUnavailable extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ModelUnavailable'
  }
}

const REJECTION_PATTERNS = [
  'model not found',
  'model_not_found',
  'does not exist',
  'no deployments available',
  'model group',
  'not supported',
  'unsupported',
  'limit-mm-per-prompt',
  'invalid model',
]

/**
 * Decide whether an HTTP failure means "this model is unusable" or just
 * "this attempt went badly".
 */
export function classify(status: number, body: string): 'unavailable' | 'transient' {
  const text = body.toLowerCase()
  if (status === 404) return 'unavailable'
  if (status === 400 && REJECTION_PATTERNS.some((p) => text.includes(p))) return 'unavailable'
  if (status === 429 && text.includes('no deployments')) return 'unavailable'
  // 408 / 429 / 500 / 502 / 503 / 504 and anything else: the model is fine, the
  // moment isn't. Cold starts land here, which is exactly what we want.
  return 'transient'
}

function benched(): Map<string, Date> {
  const rows = db.select().from(modelHealth).all()
  const now = Date.now()
  const map = new Map<string, Date>()
  for (const r of rows) if (r.disabledUntil.getTime() > now) map.set(r.model, r.disabledUntil)
  return map
}

function bench(model: string, service: AirService, reason: string, status?: number) {
  const now = new Date()
  const until = new Date(now.getTime() + DISABLE_TTL_MS)
  db.insert(modelHealth)
    .values({ model, service, reason: reason.slice(0, 300), status, disabledUntil: until, checkedAt: now })
    .onConflictDoUpdate({
      target: modelHealth.model,
      set: { service, reason: reason.slice(0, 300), status, disabledUntil: until, checkedAt: now },
    })
    .run()
}

export type AirResult<T> = { value: T; model: string; ms: number; attempts: string[] }

/**
 * Run `attempt` against each configured model for a service until one succeeds.
 *
 * - Throw `ModelUnavailable` from `attempt` (or let a rejected HTTP response be
 *   classified as such) and the model is benched for a day and skipped next time.
 * - Any other error is treated as transient: we still try the next model so the
 *   request has a chance to succeed, but nothing is benched.
 */
export async function callAir<T>(
  service: AirService,
  attempt: (model: string) => Promise<T>,
): Promise<AirResult<T>> {
  const skip = benched()
  const configured = MODELS[service] ?? []
  const candidates = configured.filter((m) => !skip.has(m))
  // Everything is benched (or nothing configured) — try the primary anyway
  // rather than fail without asking.
  const order = candidates.length > 0 ? candidates : configured.slice(0, 1)

  const attempts: string[] = []
  let lastError: unknown = new Error(`No models configured for "${service}".`)

  for (const model of order) {
    const started = Date.now()
    attempts.push(model)
    try {
      const value = await attempt(model)
      return { value, model, ms: Date.now() - started, attempts }
    } catch (err) {
      lastError = err
      if (err instanceof ModelUnavailable) {
        bench(model, service, err.message, err.status)
        console.warn(`[air] benched ${model} for ${service}: ${err.message}`)
        continue
      }
      console.warn(`[air] transient failure on ${model} for ${service}:`, err)
    }
  }

  throw lastError
}

/** Shared fetch that maps gateway rejections onto ModelUnavailable. */
export async function airFetch(path: string, init: RequestInit, timeoutMs = 45_000) {
  const key = process.env.RC_OPENAI_API_KEY
  if (!key) throw new Error('RC_OPENAI_API_KEY is not set.')

  const res = await fetch(`${AIR_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const body = (await res.text()).slice(0, 400)
    if (classify(res.status, body) === 'unavailable') {
      throw new ModelUnavailable(`AIR ${res.status}: ${body}`, res.status)
    }
    throw new Error(`AIR ${res.status}: ${body}`)
  }

  return res
}
