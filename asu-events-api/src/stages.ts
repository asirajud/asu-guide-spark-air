import { isNotNull } from 'drizzle-orm'
import { db, sqliteDb } from './db/index.js'
import { events } from './db/schema.js'
import { embedOne, rerank, fromBuffer, cosine } from './air.js'
import { DEMO_NOW, windowEnd } from './format.js'
import type { SearchFilters, EventDto } from './format.js'

export type ScoredHit = { id: string; rank: number; score: number }

// Query tokenising
const STOP = new Set([
  'the',
  'and',
  'for',
  'are',
  'any',
  'all',
  'you',
  'what',
  'when',
  'where',
  'which',
  'that',
  'this',
  'with',
  'from',
  'into',
  'about',
  'some',
  'something',
  'anything',
  'event',
  'events',
  'asu',
  'please',
  'find',
  'show',
  'tell',
  'going',
  'happening',
  'there',
  'near',
  'me',
  'is',
  'it',
  'on',
  'at',
  'in',
  'to',
  'of',
  'a',
  'an',
  'my',
  'do',
  'does',
  'can',
  'i',
])

export function ftsMatchExpression(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t))
  const uniqueTokens = [...new Set(tokens)]
  if (uniqueTokens.length === 0) return null
  return uniqueTokens.map((t) => `"${t}"`).join(' OR ')
}

// STAGE 1: BM25 over FTS5
export function bm25Stage(query: string, filters: SearchFilters, k = 40): ScoredHit[] {
  const match = ftsMatchExpression(query)
  if (!match) return []

  const sql = `
    -- Weights are positional over ALL fts5 columns, event_id included.
    -- Omitting its 0.0 shifted every weight left: title took description's
    -- boost and descriptions outranked titles.
    SELECT f.event_id AS id, bm25(events_fts, 0.0, 10.0, 3.0, 5.0, 2.0) AS score
    FROM events_fts f
    JOIN events e ON e.id = f.event_id
    WHERE events_fts MATCH ?
      AND e.start >= ? AND e.start <= ?
    ${filters.type ? 'AND lower(e.type) = ?' : ''}
    ORDER BY score ASC
    LIMIT ?
  `

  try {
    // Drizzle's timestamp mode stores epoch seconds, not milliseconds
    // So we must divide by 1000 to convert from JS timestamps (ms) to seconds
    const startSec = Math.floor(DEMO_NOW.getTime() / 1000)
    const endSec = Math.floor(windowEnd(filters).getTime() / 1000)
    const boundParams = [
      match,
      startSec,
      endSec,
      ...(filters.type ? [filters.type.toLowerCase()] : []),
      k,
    ]

    const rows = sqliteDb.prepare(sql).all(boundParams) as { id: string; score: number }[]
    return rows.map((row, i) => ({
      id: row.id,
      rank: i + 1,
      score: -row.score,
    }))
  } catch (err) {
    console.warn('FTS5 syntax error:', err)
    return []
  }
}

// STAGE 2: dense cosine
type CachedVector = { id: string; vec: Float32Array; start: number; type: string }
let vectorCache: CachedVector[] | null = null

export function invalidateVectorCache(): void {
  vectorCache = null
}

function loadVectors(): CachedVector[] {
  if (vectorCache !== null) {
    return vectorCache
  }

  const start = performance.now()
  const rows = db
    .select({
      id: events.id,
      start: events.start,
      type: events.type,
      embedding: events.embedding,
    })
    .from(events)
    .where(isNotNull(events.embedding))
    .all()

  const vectors = rows.map((row) => ({
    id: row.id,
    vec: fromBuffer(row.embedding as Buffer),
    start: row.start.getTime(),
    type: row.type,
  }))

  console.log(`Loaded ${vectors.length} vectors in ${Math.round(performance.now() - start)}ms`)
  vectorCache = vectors
  return vectors
}

export async function denseStage(
  query: string,
  filters: SearchFilters,
  k = 40,
): Promise<ScoredHit[]> {
  const rows = loadVectors()
  if (rows.length === 0) return []

  let qv: Float32Array
  try {
    qv = await embedOne(query)
  } catch (err) {
    console.warn('Embedding error:', err)
    return []
  }

  // 1,962 vectors x 2,560 dims is roughly 5 million multiply-adds — well under a millisecond in JS.
  // A vector database at this size would be pure operational overhead, so brute-forcing cosine in memory
  // is a deliberate design choice.
  const scored = rows
    .filter((row) => {
      // Apply window filter
      const now = DEMO_NOW.getTime()
      const end = windowEnd(filters).getTime()
      if (row.start < now || row.start > end) return false

      // Apply type filter if present
      return !filters.type || row.type.toLowerCase() === filters.type.toLowerCase()
    })
    .map((row) => ({
      id: row.id,
      score: cosine(qv, row.vec),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((row, i) => ({
      id: row.id,
      rank: i + 1,
      score: row.score,
    }))

  return scored
}

// STAGE 3: rerank
export async function rerankStage(
  query: string,
  candidates: EventDto[],
  topN = 20,
): Promise<Map<string, number>> {
  const slice = candidates.slice(0, topN)
  if (slice.length === 0) return new Map()

  const documents = slice.map((c) => `${c.title}. ${c.type} hosted by ${c.club}. ${c.blurb}`)

  try {
    const hits = await rerank(query, documents, slice.length)
    const result = new Map<string, number>()
    for (const hit of hits) {
      result.set(slice[hit.index].id, hit.score)
    }
    return result
  } catch (err) {
    console.warn('Reranking error:', err)
    return new Map()
  }
}
