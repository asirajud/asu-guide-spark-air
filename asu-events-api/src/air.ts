// AirError class for handling API errors
export class AirError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

// Constants for embedding and reranking
export const EMBED_MODEL = 'qwen3-embedding-4b'
export const EMBED_DIM = 2560
/**
 * AIR's /v1/rerank is undocumented but live, and it is served by the embedding
 * deployment — there is no separate reranker model id on this gateway. Verified
 * against the live endpoint: ~150ms for 20 documents, with sensible relevance scores.
 */
export const RERANK_MODEL = 'qwen3-embedding-4b'

// Type definitions for API responses
type EmbedResponse = { data: { index: number; embedding: number[] }[] }
type RerankResponse = { results: { index: number; relevance_score: number }[] }

// Helper function to make requests to the AIR gateway
async function airFetch(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const baseUrl = process.env.AIR_BASE_URL ?? 'https://openai.rc.asu.edu/v1'
  const apiKey = process.env.RC_OPENAI_API_KEY

  if (!apiKey) {
    throw new AirError('RC_OPENAI_API_KEY is not set.')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const text = await res.text()
      throw new AirError(`HTTP ${res.status}: ${text.substring(0, 400)}`, res.status)
    }

    return res
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    if (error instanceof AirError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AirError(`Request timeout after ${timeoutMs}ms`)
    }
    // Handle unknown error type properly
    throw new AirError(error instanceof Error ? error.message : String(error))
  }
}

// Embedding function
export async function embed(texts: string[], batchSize = 32): Promise<Float32Array[]> {
  if (texts.length === 0) {
    return []
  }

  const results: Float32Array[] = new Array(texts.length)

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const startTime = Date.now()

    const res = await airFetch(
      '/embeddings',
      {
        model: EMBED_MODEL,
        input: batch,
      },
      60_000,
    )

    const data = (await res.json()) as EmbedResponse

    // Validate batch size
    if (data.data.length !== batch.length) {
      throw new AirError(
        `Embedding batch returned ${data.data.length} vectors, expected ${batch.length}`,
      )
    }

    // Validate embedding dimensions
    for (const item of data.data) {
      if (item.embedding.length !== EMBED_DIM) {
        throw new AirError(
          `Embedding vector has ${item.embedding.length} dimensions, expected ${EMBED_DIM}`,
        )
      }
    }

    // Sort by index and map to Float32Array
    data.data.sort((a, b) => a.index - b.index)

    for (let j = 0; j < data.data.length; j++) {
      results[i + j] = new Float32Array(data.data[j].embedding)
    }

    const ms = Date.now() - startTime
    console.log(
      `[air] embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} in ${ms}ms`,
    )
  }

  return results
}

// Convenience function for single embedding
export async function embedOne(text: string): Promise<Float32Array> {
  const embeddings = await embed([text])
  if (embeddings.length === 0) {
    throw new AirError('No embeddings returned')
  }
  return embeddings[0]
}

// Type for rerank results
export type RerankHit = {
  index: number
  score: number
}

// Reranking function
export async function rerank(
  query: string,
  documents: string[],
  topN: number,
): Promise<RerankHit[]> {
  if (documents.length === 0) {
    return []
  }

  const res = await airFetch(
    '/rerank',
    {
      model: RERANK_MODEL,
      query,
      documents,
      top_n: Math.min(topN, documents.length),
    },
    30_000,
  )

  const data = (await res.json()) as RerankResponse

  // Map and filter results
  const hits: RerankHit[] = data.results
    .filter((result) => result.index >= 0 && result.index < documents.length)
    .map((result) => ({
      index: result.index,
      score: result.relevance_score,
    }))
    .sort((a: RerankHit, b: RerankHit) => b.score - a.score)

  return hits
}

// Convert Float32Array to Buffer
export function toBuffer(v: Float32Array): Buffer {
  return Buffer.from(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)))
}

// Convert Buffer to Float32Array
export function fromBuffer(b: Buffer): Float32Array {
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

// Calculate cosine similarity
export function cosine(a: Float32Array, b: Float32Array): number {
  // 1,962 rows x 2560 dims is ~5M multiply-adds, well under a millisecond in JS,
  // which is why this service brute-forces cosine in memory instead of adding a vector database.

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const normProduct = Math.sqrt(normA) * Math.sqrt(normB)

  if (normProduct === 0) {
    return 0
  }

  return dotProduct / normProduct
}
