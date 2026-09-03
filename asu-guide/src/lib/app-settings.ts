import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { appSettings } from '@/db/schema'

/** How many pages one notebook may hold unless an admin changes it. */
export const NOTEBOOK_PAGE_CAP_DEFAULT = 10
export const NOTEBOOK_PAGE_CAP_MIN = 1
export const NOTEBOOK_PAGE_CAP_MAX = 50

const KEY = 'notebooks.pageCap'

function read(key: string): string | null {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get()
  return row?.value ?? null
}

function write(key: string, value: string, by: string) {
  const now = new Date()
  db.insert(appSettings)
    .values({ key, value, updatedBy: by, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: by, updatedAt: now } })
    .run()
}

/** Clamped to the allowed range so a bad row can never switch uploads off or open them wide. */
export function clampPageCap(n: number): number {
  if (!Number.isFinite(n)) return NOTEBOOK_PAGE_CAP_DEFAULT
  return Math.min(NOTEBOOK_PAGE_CAP_MAX, Math.max(NOTEBOOK_PAGE_CAP_MIN, Math.round(n)))
}

export function getNotebookPageCap(): number {
  const raw = read(KEY)
  return raw == null ? NOTEBOOK_PAGE_CAP_DEFAULT : clampPageCap(Number(raw))
}

export function setNotebookPageCap(n: number, by: string): number {
  const cap = clampPageCap(n)
  write(KEY, String(cap), by)
  return cap
}
