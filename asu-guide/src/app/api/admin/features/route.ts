import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin'
import { isFeature, readFeatures, setFeature } from '@/lib/features'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await adminSession())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  return NextResponse.json({ features: readFeatures() })
}

/** Flip one switch. Takes effect on the next request; nothing to restart. */
export async function PUT(req: Request) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as {
    feature?: unknown
    enabled?: unknown
  } | null
  if (!body || !isFeature(body.feature) || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Expected { feature, enabled }.' }, { status: 400 })
  }

  setFeature(body.feature, body.enabled, admin.asurite)
  return NextResponse.json({ features: readFeatures() })
}
