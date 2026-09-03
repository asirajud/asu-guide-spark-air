import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { modelSettings } from '@/db/schema'
import { MODELS, type AirService } from './models'

export type ModelChoice = { service: AirService; model: string; updatedBy: string; updatedAt: Date }

export function readOverrides(): Map<AirService, ModelChoice> {
  const out = new Map<AirService, ModelChoice>()
  for (const r of db.select().from(modelSettings).all()) {
    out.set(r.service as AirService, {
      service: r.service as AirService,
      model: r.model,
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt,
    })
  }
  return out
}

/**
 * The order the runner should try models in for a service.
 *
 * An admin's pick goes first; the compiled-in list follows as fallback with the
 * pick removed so it is not attempted twice. Deliberately additive: a bad choice
 * costs one failed round trip, it does not strand the service with nothing to
 * fall back to.
 */
export function orderFor(service: AirService): string[] {
  const configured = MODELS[service] ?? []
  const chosen = readOverrides().get(service)?.model
  if (!chosen) return configured
  return [chosen, ...configured.filter((m) => m !== chosen)]
}

export function setModel(service: AirService, model: string, by: string) {
  const now = new Date()
  db.insert(modelSettings)
    .values({ service, model, updatedBy: by, updatedAt: now })
    .onConflictDoUpdate({
      target: modelSettings.service,
      set: { model, updatedBy: by, updatedAt: now },
    })
    .run()
}

/** Drops the override so the service goes back to the compiled-in default. */
export function clearModel(service: AirService) {
  db.delete(modelSettings).where(eq(modelSettings.service, service)).run()
}
