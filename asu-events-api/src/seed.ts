import { migrate } from './db/index.js'
import { db, sqliteDb } from './db/index.js'
import { events } from './db/schema.js'
import { embed, toBuffer } from './air.js'
import { createHash } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { eq, sql } from 'drizzle-orm'

// Location placeholder constant
export const LOCATION_PLACEHOLDER = 'Sign in to download the location'

// Parse iCal timestamp to Date object
export function parseIcal(stamp: string): Date | null {
  if (!stamp || stamp.length < 15) return null
  
  const y = parseInt(stamp.substring(0, 4), 10)
  const m = parseInt(stamp.substring(4, 6), 10)
  const d = parseInt(stamp.substring(6, 8), 10)
  const hh = parseInt(stamp.substring(9, 11), 10)
  const mm = parseInt(stamp.substring(11, 13), 10)
  const ss = parseInt(stamp.substring(13, 15), 10)
  
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss))
}

// Type for embeddable event data
type EmbeddableEvent = { title: string; club: string; org: string; type: string; description: string }

// Extract first chars from description, stripping URLs and trailing metadata
export function embedTextFor(row: EmbeddableEvent): string {
  let desc = row.description || ''
  
  // Strip trailing "| Details: ..." pattern
  const detailsIndex = desc.lastIndexOf('| Details:')
  if (detailsIndex > 0) {
    desc = desc.substring(0, detailsIndex).trim()
  }
  
  // Strip URLs
  desc = desc.replace(/https?:\/\/[^\s]+/g, '')
  
  // Collapse whitespace
  desc = desc.replace(/\s+/g, ' ').trim()
  
  // Slice to 200 chars
  desc = desc.substring(0, 200)
  
  return `${row.title}\n${row.club || row.org}\n${row.type}\n${desc}`
}

// Compute SHA256 hash
export function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

type EventInsert = typeof events.$inferInsert

async function main() {
  const startTime = Date.now()
  
  // Step 1: Migrate database
  console.log('Migrating database...')
  migrate()
  
  // Step 2: Parse JSON data
  const eventsJsonPath = path.resolve(process.cwd(), process.env.EVENTS_JSON ?? '../asu-guide/data/asu-events.json')
  const rawData = await fs.readFile(eventsJsonPath, 'utf8')
  const records = JSON.parse(rawData)
  
  console.log(`Processing ${records.length} records...`)
  
    // Process records in batches
    const batchSize = 200
    let skipped = 0
    let embeddingsWritten = 0
    let upserted = 0
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      // Process each record in the batch
      const processedRecords: EventInsert[] = []
      
      for (const record of batch) {
        // Skip if title is blank after trimming
        if (!record.title || !record.title.trim()) {
          skipped++
          continue
        }
        
        // Parse start date
        const startDate = parseIcal(record.start)
        if (!startDate) {
          skipped++
          continue
        }
        
        // Process location - normalize placeholder
        const location = record.location === LOCATION_PLACEHOLDER ? '' : (record.location || '')
        
        // Build row object with fallbacks
        const row = {
          id: record.id,
          title: record.title.trim(),
          start: startDate,
          end: record.end ? (parseIcal(record.end) ?? null) : null,
          org: record.org || '',
          orgUrl: record.orgUrl || '',
          type: record.type || '',
          club: record.club || '',
          location,
          url: record.url || '',
          description: record.description || ''
        }
        
        processedRecords.push(row)
      }
      
      // Step 5: Upsert records in batch
      if (processedRecords.length > 0) {
        for (let j = 0; j < processedRecords.length; j += 200) {
          const batch = processedRecords.slice(j, j + 200)
          db.insert(events).values(batch).onConflictDoUpdate({
            target: events.id,
            set: {
              title: sql`excluded.title`,
              start: sql`excluded.start`,
              end: sql`excluded."end"`,
              org: sql`excluded.org`,
              orgUrl: sql`excluded.org_url`,
              type: sql`excluded.type`,
              club: sql`excluded.club`,
              location: sql`excluded.location`,
              url: sql`excluded.url`,
              description: sql`excluded.description`,
            }
          }).run()
          
          upserted += batch.length
        }
      }
    }
  
  // Step 6: Incremental embedding
  console.log('Checking for embeddings to update...')
  
  // Get existing events with their embeddings
  const existingEvents = await db.select({
    id: events.id,
    embedText: events.embedText,
    embedHash: events.embedHash
  }).from(events)
  
  const eventsToReembed = []
  
  for (const record of records) {
    // Skip if title is blank after trimming
    if (!record.title || !record.title.trim()) {
      continue
    }
    
    // Parse start date
    const startDate = parseIcal(record.start)
    if (!startDate) {
      continue
    }
    
    // Process location - normalize placeholder
    const location = record.location === LOCATION_PLACEHOLDER ? '' : (record.location || '')
    
    // Build row object with fallbacks
    const row = {
      id: record.id,
      title: record.title.trim(),
      start: startDate.getTime(),
      end: record.end ? parseIcal(record.end)?.getTime() : null,
      org: record.org || '',
      orgUrl: record.orgUrl || '',
      type: record.type || '',
      club: record.club || '',
      location,
      url: record.url || '',
      description: record.description || ''
    }
    
    // Compute embed text and hash
    const embedText = embedTextFor(row)
    const newHash = hashOf(embedText)
    
    // Find existing event
    const existingEvent = existingEvents.find(e => e.id === row.id)
    
    // Check if re-embedding is needed
    if (!existingEvent || !existingEvent.embedHash || existingEvent.embedHash !== newHash || !existingEvent.embedText) {
      eventsToReembed.push({
        id: row.id,
        embedText,
        newHash
      })
    }
  }
  
  console.log(`Need to re-embed ${eventsToReembed.length} out of ${records.length} records`)
  
  if (eventsToReembed.length > 0) {
    try {
      // Get texts to embed
      const texts = eventsToReembed.map(e => e.embedText)
      
      // Embed texts
      const embeddings = await embed(texts)
      
      // Prepare update data
      const updateData: { id: string; embedding: Buffer; embedText: string; embedHash: string }[] = []
      for (let i = 0; i < eventsToReembed.length; i++) {
        const event = eventsToReembed[i]
        const embedding = embeddings[i]
        updateData.push({
          id: event.id,
          embedding: toBuffer(embedding),
          embedText: event.embedText,
          embedHash: event.newHash
        })
      }
      
// Perform batch update in transaction
      db.transaction((tx) => {
        for (const data of updateData) {
          tx.update(events)
            .set({
              embedding: data.embedding,
              embedText: data.embedText,
              embedHash: data.embedHash
            })
            .where(eq(events.id, data.id))
            .run()
        }
      })

      embeddingsWritten = updateData.length
      console.log(`Embeddings written: ${embeddingsWritten} records`)
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`Warning: Failed to embed events due to: ${error.message}. Dense retrieval will be unavailable until seed is re-run with VPN.`)
      } else {
        console.warn('Warning: Failed to embed events due to an unknown error. Dense retrieval will be unavailable until seed is re-run with VPN.')
      }
    }
  }
  
  // Step 7: Rebuild FTS5 index
  console.log('Rebuilding FTS5 index...')
  sqliteDb.exec('DELETE FROM events_fts')
  
  const insertStmt = sqliteDb.prepare(`
    INSERT INTO events_fts(event_id, title, description, club, type)
    VALUES (?, ?, ?, ?, ?)
  `)
  
  const ftsRecords = []
  
  for (const record of records) {
    // Skip if title is blank after trimming
    if (!record.title || !record.title.trim()) {
      continue
    }
    
    // Parse start date
    const startDate = parseIcal(record.start)
    if (!startDate) {
      continue
    }
    
    // Process location - normalize placeholder
    const location = record.location === LOCATION_PLACEHOLDER ? '' : (record.location || '')
    
    // Build row object with fallbacks
    const row = {
      id: record.id,
      title: record.title.trim(),
      start: startDate.getTime(),
      end: record.end ? parseIcal(record.end)?.getTime() : null,
      org: record.org || '',
      orgUrl: record.orgUrl || '',
      type: record.type || '',
      club: record.club || '',
      location,
      url: record.url || '',
      description: record.description || ''
    }
    
    ftsRecords.push([
      row.id,
      row.title,
      row.description,
      row.club,
      row.type
    ])
  }
  
  // Insert records in batch
  for (const record of ftsRecords) {
    insertStmt.run(record)
  }
  
  console.log(`Rebuilt FTS5 index with ${ftsRecords.length} rows`)
  
  // Step 8: Print final summary
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
  
  console.log('\n=== SEED SUMMARY ===')
  console.log(`Events upserted: ${upserted}`)
  console.log(`Embeddings written: ${embeddingsWritten}`)
  console.log(`Events skipped: ${skipped}`)
  console.log(`FTS rows: ${ftsRecords.length}`)
  console.log(`Elapsed time: ${elapsedSeconds} seconds`)
}

// Run the main function
await main()