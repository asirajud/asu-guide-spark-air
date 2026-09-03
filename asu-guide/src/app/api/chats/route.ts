import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'
import { listChats } from '@/lib/chats'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ chats: await listChats() })
}

/** Create a conversation and store its first exchange. */
export async function POST(req: Request) {
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
