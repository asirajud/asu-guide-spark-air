import 'server-only'

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { featureSettings } from '@/db/schema'

export type Feature = 'notebooks' | 'heatroute'

export type FeatureInfo = {
  id: Feature
  name: string
  summary: string
  /** What the app does when no admin has touched the switch. */
  defaultEnabled: boolean
}

export const FEATURES: FeatureInfo[] = [
  {
    id: 'notebooks',
    name: 'Notebooks',
    summary:
      'Students drop in photos of notebook pages; an AIR vision model reads them one at a time and a running understanding is kept per notebook. Off by default while the ingest path is new.',
    defaultEnabled: false,
  },
  {
    id: 'heatroute',
    name: 'HeatRoute',
    summary:
      'Heat-aware walking routes across Tempe campus, scored on estimated sun exposure, shade, water and shuttles, with an AIR-written explanation. Pilot data; not turn-by-turn navigation.',
    defaultEnabled: true,
  },
]

const IDS = new Set<string>(FEATURES.map((f) => f.id))

export function isFeature(x: unknown): x is Feature {
  return typeof x === 'string' && IDS.has(x)
}

export type FeatureState = FeatureInfo & { enabled: boolean; updatedBy: string | null }

/** Every feature with its effective state — the stored choice, else the default. */
export function readFeatures(): FeatureState[] {
  const rows = new Map(
    db
      .select()
      .from(featureSettings)
      .all()
      .map((r) => [r.feature, r]),
  )
  return FEATURES.map((f) => {
    const row = rows.get(f.id)
    return { ...f, enabled: row?.enabled ?? f.defaultEnabled, updatedBy: row?.updatedBy ?? null }
  })
}

export function isFeatureEnabled(feature: Feature): boolean {
  return readFeatures().find((f) => f.id === feature)?.enabled ?? false
}

export function setFeature(feature: Feature, enabled: boolean, by: string) {
  const now = new Date()
  db.insert(featureSettings)
    .values({ feature, enabled, updatedBy: by, updatedAt: now })
    .onConflictDoUpdate({
      target: featureSettings.feature,
      set: { enabled, updatedBy: by, updatedAt: now },
    })
    .run()
}

/**
 * For API routes behind a switch: a 404 when the feature is off, else null.
 * 404 rather than 403 so a disabled feature is indistinguishable from one that
 * was never deployed.
 */
export function featureGate(feature: Feature): NextResponse | null {
  if (isFeatureEnabled(feature)) return null
  return NextResponse.json({ error: 'Not found.' }, { status: 404 })
}
