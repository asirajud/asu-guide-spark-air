import 'server-only'
import { and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { events } from '@/db/schema'

/** The demo is pinned to this "today" so the scripted response always looks fresh. */
/**
 * "Now" for the demo. Pinned so the shortlist is reproducible, but never behind
 * the real clock — a pinned past date surfaces events that already happened,
 * which reads as a bug the moment someone checks the date on a card.
 */
export const DEMO_NOW = (() => {
  const pinned = new Date('2026-09-02T12:00:00Z')
  const now = new Date()
  return now > pinned ? now : pinned
})()
const WINDOW_END = new Date('2026-09-17T00:00:00Z')

/** ~84% of the feed has this placeholder instead of a real location. Never show it. */
const LOCATION_PLACEHOLDER = 'Sign in to download the location'

export type DemoEvent = {
  id: string
  title: string
  when: string
  club: string
  type: string
  blurb: string
  url: string
}

const TZ = 'America/Phoenix'

const dayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
})

/** "Thu, Sep 4 · 6:00 PM" */
export function formatWhen(d: Date) {
  return `${dayFmt.format(d)} · ${timeFmt.format(d)}`
}

/** Strip the trailing "| Details: <url>" the iCal feed appends, collapse whitespace. */
function cleanDescription(raw: string) {
  return raw
    .replace(/\|\s*Details:[\s\S]*$/i, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(s: string, n = 110) {
  if (s.length <= n) return s
  return `${s.slice(0, n).replace(/[\s,.;:-]+$/, '')}…`
}

/** Titles that read like internal calendar noise rather than something you'd pitch. */
const JUNK_TITLE = /^(tbd|tba|n\/?a|meeting|weekly meeting|gbm ?\d*|test|open gym|tabling)$/i



const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, dateStyle: 'short' })

/**
 * The opening suggestion cards only.
 *
 * Relevance ranking used to live here as a keyword heuristic; it now belongs to
 * asu-events-api, reached through the search_events tool. What is left is a
 * spread: soonest first, one per club and where possible one per day, filtered
 * to events with a real title and a usable description.
 */
export async function getDemoEvents(limit = 5): Promise<DemoEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(and(gte(events.start, DEMO_NOW), lte(events.start, WINDOW_END)))
    .orderBy(sql`${events.start} asc`)

  const candidates = rows
    .map((r) => ({ row: r, blurb: cleanDescription(r.description) }))
    .filter(({ row, blurb }) => {
      const title = row.title.trim()
      if (title.length < 10 || JUNK_TITLE.test(title)) return false
      if (blurb.length < 90) return false
      return Boolean(row.org?.trim())
    })
    .sort((a, b) => a.row.start.getTime() - b.row.start.getTime())

  const seenClub = new Set<string>()
  const seenDay = new Set<string>()
  const picked: typeof candidates = []

  // Pass 0 spreads across days; pass 1 backfills if the window is thin.
  for (const pass of [0, 1]) {
    for (const c of candidates) {
      if (picked.length >= limit) break
      const club = c.row.org.trim()
      const day = dayKey.format(c.row.start)
      if (seenClub.has(club)) continue
      if (pass === 0 && seenDay.has(day)) continue
      seenClub.add(club)
      seenDay.add(day)
      picked.push(c)
    }
  }

  return picked
    .slice(0, limit)
    .sort((a, b) => a.row.start.getTime() - b.row.start.getTime())
    .map(({ row, blurb }) => ({
      id: row.id,
      title: row.title.trim(),
      when: formatWhen(row.start),
      club: row.org.trim(),
      type: row.type || 'Event',
      blurb: truncate(blurb),
      url: row.url,
    }))
}



export { LOCATION_PLACEHOLDER }
