import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'
import { getChat } from '@/lib/chats'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { id } = await params
  const found = await getChat(id, session.asurite)
  if (!found) return NextResponse.json({ error: 'No such chat.' }, { status: 404 })
  return NextResponse.json(found)
}

/** Rename, pin/unpin, or append a message to an existing conversation. */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { id } = await params
  // Ownership check before any write — an id alone must not grant access.
  if (!(await getChat(id, session.asurite))) {
    return NextResponse.json({ error: 'No such chat.' }, { status: 404 })
  }
  const body = (await req.json()) as {
    title?: string
    pinned?: boolean
    append?: {
      role: 'user' | 'assistant'
      content: string
      kind?: string
      imageName?: string | null
    }
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof body.title === 'string' && body.title.trim())
    patch.title = body.title.trim().slice(0, 80)
  if (typeof body.pinned === 'boolean') patch.pinned = body.pinned

  await db.update(conversations).set(patch).where(eq(conversations.id, id))

  if (body.append) {
    await db.insert(messages).values({
      id: randomUUID(),
      conversationId: id,
      role: body.append.role,
      content: body.append.content,
      kind: body.append.kind ?? 'text',
      imageName: body.append.imageName ?? null,
      createdAt: new Date(),
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { id } = await params
  if (!(await getChat(id, session.asurite))) {
    return NextResponse.json({ error: 'No such chat.' }, { status: 404 })
  }
  await db.delete(messages).where(eq(messages.conversationId, id))
  await db.delete(conversations).where(eq(conversations.id, id))
  return NextResponse.json({ ok: true })
}
