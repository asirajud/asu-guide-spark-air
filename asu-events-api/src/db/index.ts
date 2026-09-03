import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const sqlite = new Database(process.env.EVENTS_DB ?? 'events.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')

export const sqliteDb = sqlite
export const db = drizzle(sqlite, { schema })
export { schema }

export function migrate(): void {
  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start INTEGER NOT NULL,
      "end" INTEGER,
      org TEXT NOT NULL DEFAULT '',
      org_url TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      club TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      embed_text TEXT NOT NULL DEFAULT '',
      embed_hash TEXT NOT NULL DEFAULT '',
      embedding BLOB
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      asurite TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `)

  // Create indexes
  sqlite.exec('CREATE INDEX IF NOT EXISTS events_start_idx ON events(start)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS reservations_asurite_idx ON reservations(asurite)')

  // Create FTS5 virtual table
  // This is a standalone (not external-content) FTS5 table keyed by event_id,
  // rebuilt wholesale by the seeder, so no sync triggers are needed.
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
      event_id UNINDEXED,
      title,
      description,
      club,
      type,
      tokenize = 'porter unicode61'
    )
  `)
}
