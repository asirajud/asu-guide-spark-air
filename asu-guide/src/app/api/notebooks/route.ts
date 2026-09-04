import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { featureGate } from '@/lib/features'
import { listNotebooks, createNotebook } from '@/lib/notebooks'

export const runtime = 'nodejs'

/** List notebooks for the signed-in user. */
export async function GET() {
  const gate = featureGate('notebooks')
  if (gate) return gate
  const session = await getSession()
  if (!session) return NextResponse.json({ notebooks: [] })
  return NextResponse.json({ notebooks: await listNotebooks(session.asurite) })
}

/** Create a new notebook for the signed-in user. */
export async function POST(req: Request) {
  const gate = featureGate('notebooks')
  if (gate) return gate
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Sign in to create a notebook.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { name?: unknown }

  const nb = await createNotebook(session.asurite, typeof body.name === 'string' ? body.name : '')

  return NextResponse.json({ id: nb.id, name: nb.name }, { status: 201 })
}
