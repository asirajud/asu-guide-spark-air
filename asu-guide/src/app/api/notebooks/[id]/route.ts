import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { featureGate } from '@/lib/features'
import { getNotebook, renameNotebook, deleteNotebook } from '@/lib/notebooks'
import { getNotebookPageCap } from '@/lib/app-settings'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

/** Read a notebook and its pages. Ownership is enforced by the lib (an id alone grants nothing). */
export async function GET(_req: Request, { params }: Ctx) {
  const gate = featureGate('notebooks')
  if (gate) return gate
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { id } = await params
  const found = await getNotebook(id, session.asurite)
  if (!found) return NextResponse.json({ error: 'No such notebook.' }, { status: 404 })

  return NextResponse.json({
    /** Pages this notebook may hold in total; the client sizes its queue by it. */
    cap: getNotebookPageCap(),
    notebook: {
      id: found.notebook.id,
      name: found.notebook.name,
      digest: found.notebook.digest,
      digestModel: found.notebook.digestModel,
      updatedAt: found.notebook.updatedAt.getTime(),
    },
    pages: found.pages.map((p) => ({
      id: p.id,
      position: p.position,
      imageName: p.imageName,
      reading: p.reading,
      status: p.status,
      model: p.model,
      ms: p.ms,
    })),
  })
}

/** Rename a notebook. Ownership is enforced by the lib (an id alone grants nothing). */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = featureGate('notebooks')
  if (gate) return gate
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.name !== 'string' || !body.name.trim())
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const ok = await renameNotebook(id, session.asurite, body.name.trim().slice(0, 80))
  if (!ok) return NextResponse.json({ error: 'No such notebook.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

/** Delete a notebook. Ownership is enforced by the lib (an id alone grants nothing). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = featureGate('notebooks')
  if (gate) return gate
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { id } = await params
  const ok = await deleteNotebook(id, session.asurite)
  if (!ok) return NextResponse.json({ error: 'No such notebook.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
