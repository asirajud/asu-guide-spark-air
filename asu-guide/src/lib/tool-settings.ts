import 'server-only'

import { db } from '@/db'
import { toolSettings } from '@/db/schema'

/** Tool names an admin has explicitly switched off. */
export function disabledTools(): Set<string> {
  return new Set(
    db
      .select()
      .from(toolSettings)
      .all()
      .filter((r) => !r.enabled)
      .map((r) => r.name),
  )
}

export function toolAudit(): Map<string, { enabled: boolean; updatedBy: string; updatedAt: Date }> {
  const out = new Map<string, { enabled: boolean; updatedBy: string; updatedAt: Date }>()
  for (const r of db.select().from(toolSettings).all()) {
    out.set(r.name, { enabled: r.enabled, updatedBy: r.updatedBy, updatedAt: r.updatedAt })
  }
  return out
}

export function setToolEnabled(name: string, enabled: boolean, by: string) {
  const now = new Date()
  db.insert(toolSettings)
    .values({ name, enabled, updatedBy: by, updatedAt: now })
    .onConflictDoUpdate({
      target: toolSettings.name,
      set: { enabled, updatedBy: by, updatedAt: now },
    })
    .run()
}
