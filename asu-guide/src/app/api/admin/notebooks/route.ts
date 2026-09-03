import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin'
import { isFeatureEnabled, setFeature } from '@/lib/features'
import {
  NOTEBOOK_PAGE_CAP_MAX,
  NOTEBOOK_PAGE_CAP_MIN,
  getNotebookPageCap,
  setNotebookPageCap,
} from '@/lib/app-settings'

export const runtime = 'nodejs'

function snapshot() {
  return {
    enabled: isFeatureEnabled('notebooks'),
    pageCap: getNotebookPageCap(),
    pageCapMin: NOTEBOOK_PAGE_CAP_MIN,
    pageCapMax: NOTEBOOK_PAGE_CAP_MAX,
  }
}

export async function GET() {
  if (!(await adminSession())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  return NextResponse.json(snapshot())
}

/** Partial update: send `enabled`, `pageCap`, or both. Takes effect on the next request. */
export async function PUT(req: Request) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as {
    enabled?: unknown
    pageCap?: unknown
  } | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be true or false.' }, { status: 400 })
  }
  if (body.pageCap !== undefined && typeof body.pageCap !== 'number') {
    return NextResponse.json({ error: 'pageCap must be a number.' }, { status: 400 })
  }

  if (typeof body.enabled === 'boolean') setFeature('notebooks', body.enabled, admin.asurite)
  if (typeof body.pageCap === 'number') setNotebookPageCap(body.pageCap, admin.asurite)

  return NextResponse.json(snapshot())
}
