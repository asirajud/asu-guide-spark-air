import { inArray, eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { events } from './db/schema.js'
import { bm25Stage, denseStage, rerankStage, type ScoredHit } from './stages.js'
import { toDto, type EventDto, type SearchFilters } from './format.js'

export type SearchHit = EventDto & {
  fusedScore: number
  rerankScore: number | null
  /**
   * Which stages found this event, and at what RANK in each.
   * Keys are stage names, values are 1-based ranks within each stage.
   * An absent key means that stage did not return the event at all.
   */
  stages: { bm25?: number; dense?: number }
}

export type SearchTrace = {
  query: string
  bm25: { ms: number; count: number; top: string[] }
  dense: { ms: number; count: number; top: string[]; available: boolean }
  fusion: { ms: number; count: number; onlyBm25: number; onlyDense: number; both: number }
  rerank: { ms: number; count: number; available: boolean; movedIntoTop: string[] }
  totalMs: number
}

export type SearchResult = { hits: SearchHit[]; trace: SearchTrace }

export type FusedHit = { id: string; fusedScore: number; stages: { bm25?: number; dense?: number } }

export const RRF_K = 60

export function fuse(bm25: ScoredHit[], dense: ScoredHit[], k = RRF_K): FusedHit[] {
  // k = 60 is the standard RRF constant, and RRF is used here rather than a normalised score blend
  // because BM25 scores and cosine similarities are on incomparable scales and per-query min-max
  // normalisation is unstable on result sets this small.

  const fusedMap = new Map<string, FusedHit>()

  // Process BM25 hits
  bm25.forEach((hit, rank) => {
    const entry = fusedMap.get(hit.id)
    if (entry) {
      entry.stages.bm25 = rank + 1
      entry.fusedScore += 1 / (k + rank + 1)
    } else {
      fusedMap.set(hit.id, {
        id: hit.id,
        fusedScore: 1 / (k + rank + 1),
        stages: { bm25: rank + 1 },
      })
    }
  })

  // Process dense hits
  dense.forEach((hit, rank) => {
    const entry = fusedMap.get(hit.id)
    if (entry) {
      entry.stages.dense = rank + 1
      entry.fusedScore += 1 / (k + rank + 1)
    } else {
      fusedMap.set(hit.id, {
        id: hit.id,
        fusedScore: 1 / (k + rank + 1),
        stages: { dense: rank + 1 },
      })
    }
  })

  // Convert to array and sort
  return Array.from(fusedMap.values())
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .map((entry) => {
      // Break ties on the better (numerically lower) of the ranks the id has
      const bm25Rank =
        entry.stages.bm25 !== undefined
          ? bm25.findIndex((hit) => hit.id === entry.id) + 1
          : Infinity
      const denseRank =
        entry.stages.dense !== undefined
          ? dense.findIndex((hit) => hit.id === entry.id) + 1
          : Infinity
      const tieBreaker = Math.min(bm25Rank, denseRank)

      // Return with the tie-breaker ranking embedded in the score for consistent sorting
      return {
        ...entry,
        fusedScore: entry.fusedScore + 1 / (tieBreaker * 1000), // Small adjustment to break ties consistently
      }
    })
    .sort((a, b) => b.fusedScore - a.fusedScore)
}

export function getEvent(id: string): EventDto | null {
  const row = db.select().from(events).where(eq(events.id, id)).get()
  return row ? toDto(row) : null
}

export async function search(query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  const t0 = performance.now()
  let rerankMs = 0
  const limit = Math.min(Math.max(filters.limit ?? 5, 1), 20)

  // Time bm25Stage
  const b0 = performance.now()
  const bm25Hits = bm25Stage(query, filters, 40)
  const bm25Ms = performance.now() - b0

  // Time denseStage
  const d0 = performance.now()
  const denseHits = await denseStage(query, filters, 40)
  const denseMs = performance.now() - d0

  // Time fuse
  const f0 = performance.now()
  const fused = fuse(bm25Hits, denseHits)
  const fusionMs = performance.now() - f0

  const trace: SearchTrace = {
    query,
    bm25: { ms: Math.round(bm25Ms * 100) / 100, count: bm25Hits.length, top: [] },
    dense: {
      ms: Math.round(denseMs * 100) / 100,
      count: denseHits.length,
      top: [],
      available: false,
    },
    fusion: {
      ms: Math.round(fusionMs * 100) / 100,
      count: fused.length,
      onlyBm25: 0,
      onlyDense: 0,
      both: 0,
    },
    rerank: { ms: Math.round(rerankMs * 100) / 100, count: 0, available: false, movedIntoTop: [] },
    totalMs: 0,
  }

  if (fused.length === 0) {
    trace.dense.available = denseHits.length > 0
    trace.totalMs = Math.round((performance.now() - t0) * 100) / 100
    // Assign trace values here to fix eslint no-useless-assignment
    trace.bm25.ms = Math.round(bm25Ms * 100) / 100
    trace.dense.ms = Math.round(denseMs * 100) / 100
    trace.fusion.ms = Math.round(fusionMs * 100) / 100
    trace.rerank.ms = Math.round(rerankMs * 100) / 100
    return { hits: [], trace }
  }

  // Load rows for every fused id in ONE query
  const rows = db
    .select()
    .from(events)
    .where(
      inArray(
        events.id,
        fused.map((f) => f.id),
      ),
    )
    .all()
  const dtoMap = new Map(rows.map((row) => [row.id, toDto(row)]))

  // Build fusion order
  const fusionOrder: SearchHit[] = []
  for (const f of fused) {
    const dto = dtoMap.get(f.id)
    if (dto) {
      fusionOrder.push({
        ...dto,
        fusedScore: f.fusedScore,
        rerankScore: null,
        stages: f.stages,
      })
    }
  }

  // Remove near-duplicates: keep only the first occurrence of each title+club combination
  // The feed carries recurring events as separate rows with identical titles, so one
  // representative per title+club is what a student actually wants to see.
  const seen = new Set<string>()
  const dedupedFusionOrder: SearchHit[] = []
  for (const hit of fusionOrder) {
    const key = `${hit.title.toLowerCase()}|${hit.club.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      dedupedFusionOrder.push(hit)
    }
  }
  const fusionOrderNoDuplicates = dedupedFusionOrder

  const fusionTopIds = new Set(fusionOrderNoDuplicates.slice(0, limit).map((h) => h.id))

  // Time rerankStage
  const r0 = performance.now()
  const scores = await rerankStage(query, fusionOrderNoDuplicates, 20)
  rerankMs = performance.now() - r0

  let ordered: SearchHit[] = fusionOrderNoDuplicates

  if (scores.size > 0) {
    // Take the first 20 of fusionOrder and set each one's rerankScore from the map
    const rerankedSlice = fusionOrderNoDuplicates
      .slice(0, 20)
      .map((hit) => ({
        ...hit,
        rerankScore: scores.get(hit.id) ?? -Infinity,
      }))
      .sort((a, b) => (b.rerankScore ?? -Infinity) - (a.rerankScore ?? -Infinity))

    // Concatenate the untouched remainder after it
    const untouched = fusionOrderNoDuplicates.slice(20)
    ordered = [...rerankedSlice, ...untouched]

    trace.rerank.count = rerankedSlice.length
  } else {
    trace.rerank.count = 0
  }

  // Final results
  const final = ordered.slice(0, limit)

  // Determine movedIntoTop using IDs instead of titles to handle recurring events correctly
  trace.rerank.movedIntoTop = final.filter((h) => !fusionTopIds.has(h.id)).map((h) => h.title)

  // Set availability flags
  trace.dense.available = denseHits.length > 0
  trace.rerank.available = scores.size > 0

  // Count fusion types
  trace.fusion.onlyBm25 = fused.filter(
    (f) => f.stages.bm25 !== undefined && f.stages.dense === undefined,
  ).length
  trace.fusion.onlyDense = fused.filter(
    (f) => f.stages.bm25 === undefined && f.stages.dense !== undefined,
  ).length
  trace.fusion.both = fused.filter(
    (f) => f.stages.bm25 !== undefined && f.stages.dense !== undefined,
  ).length

  // Get top titles from each stage - ensure they come from respective stage results
  trace.bm25.top = bm25Hits.slice(0, 3).map((hit) => {
    const dto = dtoMap.get(hit.id)
    return dto?.title ?? hit.id
  })

  trace.dense.top = denseHits.slice(0, 3).map((hit) => {
    const dto = dtoMap.get(hit.id)
    return dto?.title ?? hit.id
  })

  // Assign trace values at the end to fix eslint no-useless-assignment
  trace.bm25.ms = Math.round(bm25Ms * 100) / 100
  trace.dense.ms = Math.round(denseMs * 100) / 100
  trace.fusion.ms = Math.round(fusionMs * 100) / 100
  trace.rerank.ms = Math.round(rerankMs * 100) / 100
  trace.totalMs = Math.round((performance.now() - t0) * 100) / 100

  return { hits: final, trace }
}
