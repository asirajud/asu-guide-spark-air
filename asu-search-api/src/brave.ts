/**
 * Web search against the Brave Search API.
 *
 * Called over HTTPS with a key from the environment so the service is
 * self-contained and deployable — no local CLI, no gateway, nothing that only
 * exists on one laptop. A free Brave key (2,000 queries/month) is enough for
 * this workload: https://brave.com/search/api/
 */
export type WebResult = {
  title: string
  url: string
  snippet: string
  age?: string
  source?: string
}

const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'
const TIMEOUT_MS = 15_000

export class SearchNotConfigured extends Error {
  constructor() {
    super('BRAVE_API_KEY is not set — see .env.example')
    this.name = 'SearchNotConfigured'
  }
}

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export function isConfigured(): boolean {
  return Boolean(process.env.BRAVE_API_KEY)
}

export async function webSearch(
  query: string,
  count = 5,
  freshness?: string,
): Promise<WebResult[]> {
  const key = process.env.BRAVE_API_KEY
  if (!key) throw new SearchNotConfigured()

  const params = new URLSearchParams({
    q: query.slice(0, 400),
    count: String(Math.min(Math.max(count, 1), 10)),
  })
  if (freshness) params.set('freshness', freshness)

  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': key,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`Brave search returned ${res.status}`)
  }

  const data = (await res.json()) as { web?: { results?: unknown[] } }
  const results = data.web?.results ?? []

  return results.slice(0, count).map((r) => {
    const row = r as Record<string, unknown>
    const url = String(row.url ?? '')
    return {
      title: clean(String(row.title ?? '')),
      url,
      snippet: clean(String(row.description ?? '')),
      age: row.age ? String(row.age) : undefined,
      source: hostOf(url),
    }
  })
}
