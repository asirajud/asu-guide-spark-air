import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'

export type ChatSummary = {
  id: string
  title: string
  pinned: boolean
  updatedAt: number
}

export async function listChats(asurite: string): Promise<ChatSummary[]> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.asurite, asurite))
    .orderBy(desc(conversations.pinned), desc(conversations.updatedAt))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    pinned: r.pinned,
    updatedAt: r.updatedAt.getTime(),
  }))
}

/** Scoped by owner — a conversation id alone must not grant access. */
export async function getChat(id: string, asurite: string) {
  const [chat] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.asurite, asurite)))
    .limit(1)
  if (!chat) return null

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    // createdAt is second-resolution, and both turns of an exchange can land in
    // the same second when the lazy conversation-create resolves late. rowid is
    // monotonic per insert, so it breaks the tie in true insertion order.
    .orderBy(messages.createdAt, sql`rowid`)

  return { chat, messages: msgs }
}
