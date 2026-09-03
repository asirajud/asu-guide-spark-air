import type { EventRow } from './db/schema.js'
/** The demo is pinned to this "today" so the 1,962-row snapshot always looks live. */
/**
 * Pinned for reproducibility, but never behind the wall clock — a fixed past
 * floor would start returning events the student has already missed, and the
 * assistant would cite them as upcoming.
 */
export const DEMO_NOW = (() => {
  const pinned = new Date('2026-09-03T07:00:00Z')
  const now = new Date()
  return now > pinned ? now : pinned
})()

/**
 * ~84% of the Sun Devil Central feed carries this string instead of a venue.
 * It is a placeholder, not a location, and must never be rendered.
 */
export const LOCATION_PLACEHOLDER = 'Sign in to download the location'

const TZ = 'America/Phoenix'

const dayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: TZ,
})

const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TZ,
})

export type SearchFilters = { daysAhead?: number; type?: string; limit?: number }

export type EventDto = {
  id: string
  title: string
  when: string
  startIso: string
  club: string
  org: string
  type: string
  venue: string | null
  blurb: string
  url: string
}

export function formatWhen(d: Date): string {
  return `${dayFmt.format(d)} · ${timeFmt.format(d)}`
}

export function cleanDescription(raw: string): string {
  return raw
    .replace(/\|\s*Details:[\s\S]*$/i, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(s: string, n = 180): string {
  if (s.length <= n) {
    return s
  }
  const truncated = s.slice(0, n)
  return truncated.replace(/[\s\p{P}]+$/u, '') + '…'
}

export function windowEnd(filters: SearchFilters): Date {
  return new Date(DEMO_NOW.getTime() + (filters.daysAhead ?? 21) * 86_400_000)
}

export function toDto(row: EventRow): EventDto {
  const venue =
    !row.location?.trim() || row.location === LOCATION_PLACEHOLDER ? null : row.location.trim()

  return {
    id: row.id,
    title: row.title.trim(),
    when: formatWhen(row.start),
    startIso: row.start.toISOString(),
    club: row.club.trim() || row.org.trim(),
    org: row.org.trim() || row.club.trim(),
    type: row.type.trim() || 'Event',
    venue,
    blurb: truncate(cleanDescription(row.description)),
    url: row.url,
  }
}
