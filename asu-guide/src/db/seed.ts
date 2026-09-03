/**
 * Seeds the SQLite DB from the prepared ASU events JSON
 * (public Sun Devil Central iCal feed export).
 */
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = process.env.EVENTS_JSON ?? resolve(process.cwd(), 'data/asu-events.json')

type Raw = {
  id: string
  title: string
  start: string
  end: string
  org: string
  orgUrl: string
  type: string
  club: string
  location: string
  url: string
  description: string
}

/** iCal UTC stamp -> Date. e.g. 20260902T000000Z */
function parseICal(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(s ?? '')
  if (!m) return null
  const [, y, mo, d, h, mi, sec] = m
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec))
}

const raw: Raw[] = JSON.parse(readFileSync(SOURCE, 'utf8'))

const sqlite = new Database(process.env.DATABASE_URL ?? 'local.db')
sqlite.pragma('journal_mode = WAL')
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start INTEGER NOT NULL,
    end INTEGER,
    org TEXT NOT NULL DEFAULT '',
    org_url TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT '',
    club TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS events_start_idx ON events(start);
`)
sqlite.exec('DELETE FROM events')

const insert = sqlite.prepare(
  `INSERT OR REPLACE INTO events
   (id, title, start, end, org, org_url, type, club, location, url, description)
   VALUES (@id, @title, @start, @end, @org, @org_url, @type, @club, @location, @url, @description)`,
)

let inserted = 0
let skipped = 0
const run = sqlite.transaction((rows: Raw[]) => {
  for (const r of rows) {
    const start = parseICal(r.start)
    if (!start || !r.title?.trim()) {
      skipped++
      continue
    }
    const end = parseICal(r.end)
    insert.run({
      id: r.id,
      title: r.title.trim(),
      start: Math.floor(start.getTime() / 1000),
      end: end ? Math.floor(end.getTime() / 1000) : null,
      org: r.org ?? '',
      org_url: r.orgUrl ?? '',
      type: r.type ?? '',
      club: r.club ?? '',
      location: r.location ?? '',
      url: r.url ?? '',
      description: (r.description ?? '').trim(),
    })
    inserted++
  }
})
run(raw)

console.log(`Seeded ${inserted} events (${skipped} skipped) from ${SOURCE}`)
sqlite.close()
