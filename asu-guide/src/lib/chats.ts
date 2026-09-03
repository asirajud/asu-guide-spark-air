import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'

export type ChatSummary = {
  id: string
  title: string
  pinned: boolean
  updatedAt: number
}

export async function listChats(): Promise<ChatSummary[]> {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.pinned), desc(conversations.updatedAt))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    pinned: r.pinned,
    updatedAt: r.updatedAt.getTime(),
  }))
}

export async function getChat(id: string) {
  const [chat] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!chat) return null

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt)

  return { chat, messages: msgs }
}
