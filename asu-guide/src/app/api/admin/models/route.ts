import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin'
import { airFetch } from '@/lib/air/call'
import { MODELS } from '@/lib/air/models'

export const runtime = 'nodejs'

type Catalog = { models: string[]; source: 'air' | 'fallback'; error?: string }

let cache: { at: number; data: Catalog } | null = null
const TTL_MS = 5 * 60 * 1000

/**
 * The dropdowns are populated from the gateway itself rather than a list baked
 * into the app, so a model added to AIR shows up here without a deploy.
 *
 * When the gateway is unreachable — VPN down, most likely — this falls back to
 * the models already named in lib/air/models.ts and says so, rather than
 * handing the admin an empty dropdown that looks like the catalog is empty.
 */
export async function GET() {
  if (!(await adminSession())) {
    return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  }

  if (cache && Date.now() - cache.at < TTL_MS) return NextResponse.json(cache.data)

  const compiled = [...new Set(Object.values(MODELS).flat())].sort()

  try {
    const res = await airFetch('/models', { method: 'GET' }, 10_000)
    const body = (await res.json()) as { data?: { id?: string }[] }
    const models = (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .sort()

    if (models.length === 0) throw new Error('The gateway returned an empty catalog.')

    const data: Catalog = { models, source: 'air' }
    cache = { at: Date.now(), data }
    return NextResponse.json(data)
  } catch (err) {
    // Not cached: a transient VPN drop should not pin the fallback for 5 minutes.
    return NextResponse.json({
      models: compiled,
      source: 'fallback',
      error: err instanceof Error ? err.message : 'The AIR gateway could not be reached.',
    } satisfies Catalog)
  }
}
