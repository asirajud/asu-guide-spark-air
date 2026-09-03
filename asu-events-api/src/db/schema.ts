// This service owns its own SQLite database and deliberately does not share asu-guide's.
import { sqliteTable, text, integer, blob, index } from 'drizzle-orm/sqlite-core'

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    start: integer('start', { mode: 'timestamp' }).notNull(),
    end: integer('end', { mode: 'timestamp' }),
    org: text('org').notNull().default(''),
    orgUrl: text('org_url').notNull().default(''),
    type: text('type').notNull().default(''),
    club: text('club').notNull().default(''),
    location: text('location').notNull().default(''),
    url: text('url').notNull().default(''),
    description: text('description').notNull().default(''),
    // The exact string that was embedded, plus its sha256. The hash lets a
    // refresh re-embed only the rows whose text actually changed.
    embedText: text('embed_text').notNull().default(''),
    embedHash: text('embed_hash').notNull().default(''),
    // 2560 float32s from qwen3-embedding-4b, stored raw. 1,962 rows x 2560 x 4B
    // is ~20MB - small enough to hold in memory and brute-force scan, which is
    // why this service has no vector database.
    embedding: blob('embedding', { mode: 'buffer' }),
  },
  (t) => [index('events_start_idx').on(t.start)],
)

export const reservations = sqliteTable(
  'reservations',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    asurite: text('asurite').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('reservations_asurite_idx').on(t.asurite)],
)

export type EventRow = typeof events.$inferSelect
export type ReservationRow = typeof reservations.$inferSelect
