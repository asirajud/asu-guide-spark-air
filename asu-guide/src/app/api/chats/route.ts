import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'
import { listChats } from '@/lib/chats'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ chats: [] })
  return NextResponse.json({ chats: await listChats(session.asurite) })
}

/** Create a conversation and store its first exchange. */
export async function POST(req: Request) {
  // Conversations belong to an account; there is nowhere to file one otherwise.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Sign in to save conversations.' }, { status: 401 })
  }

  const body = (await req.json()) as {
    title?: string
    prompt?: string
    reply?: string
    kind?: string
    imageName?: string | null
  }

  const now = new Date()
  const id = randomUUID()

  await db.insert(conversations).values({
    id,
    asurite: session.asurite,
    title: (body.title ?? '').trim() || 'New chat',
    createdAt: now,
    updatedAt: now,
  })

  const rows = []
  if (body.prompt) {
    rows.push({
      id: randomUUID(),
      conversationId: id,
      role: 'user' as const,
      content: body.prompt,
      kind: body.kind ?? 'text',
      imageName: body.imageName ?? null,
      createdAt: now,
    })
  }
  if (body.reply) {
    rows.push({
      id: randomUUID(),
      conversationId: id,
      role: 'assistant' as const,
      content: body.reply,
      kind: body.kind ?? 'text',
      imageName: null,
      createdAt: new Date(now.getTime() + 1),
    })
  }
  if (rows.length) await db.insert(messages).values(rows)

  return NextResponse.json({ id })
}
