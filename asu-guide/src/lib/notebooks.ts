import 'server-only'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { notebooks, notebookPages, type NotebookRow, type NotebookPageRow } from '@/db/schema'

export type NotebookSummary = { id: string; name: string; pageCount: number; updatedAt: number }

/** Every notebook owned by this ASURITE, most recently touched first. Never shared across accounts. */
export async function listNotebooks(asurite: string): Promise<NotebookSummary[]> {
  const rows = await db
    .select({
      id: notebooks.id,
      name: notebooks.name,
      updatedAt: notebooks.updatedAt,
      pageCount: sql<number>`count(${notebookPages.id})`,
    })
    .from(notebooks)
    .leftJoin(notebookPages, eq(notebookPages.notebookId, notebooks.id))
    .where(eq(notebooks.asurite, asurite))
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    pageCount: r.pageCount,
    updatedAt: r.updatedAt.getTime(),
  }))
}

export async function createNotebook(asurite: string, name: string): Promise<NotebookRow> {
  const id = randomUUID()
  const now = new Date()
  const trimmedName = name.trim() || 'New notebook'

  const [row] = await db
    .insert(notebooks)
    .values({
      id,
      asurite,
      name: trimmedName,
      digest: '',
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return row
}

/** Scoped by owner — a notebook id alone must not grant access. Pages come back in position order. */
export async function getNotebook(
  id: string,
  asurite: string,
): Promise<{ notebook: NotebookRow; pages: NotebookPageRow[] } | null> {
  const [notebook] = await db
    .select()
    .from(notebooks)
    .where(and(eq(notebooks.id, id), eq(notebooks.asurite, asurite)))
    .limit(1)

  if (!notebook) return null

  const pages = await db
    .select()
    .from(notebookPages)
    .where(eq(notebookPages.notebookId, id))
    .orderBy(asc(notebookPages.position))

  return { notebook, pages }
}

/** Position the next uploaded page should take: one past the highest so far, or 1. Caller has already checked ownership. */
export async function nextPosition(notebookId: string): Promise<number> {
  const [{ maxPosition }] = await db
    .select({ maxPosition: sql<number>`max(${notebookPages.position})` })
    .from(notebookPages)
    .where(eq(notebookPages.notebookId, notebookId))

  return (maxPosition || 0) + 1
}

/** Store what the OCR model read off one page, and bump the notebook's updatedAt. Caller has already checked ownership. */
export async function addPage(input: {
  notebookId: string
  position: number
  imageName: string
  reading: string
  status: 'read' | 'failed'
  model: string
  ms: number
}): Promise<NotebookPageRow> {
  const now = new Date()

  const [page] = await db
    .insert(notebookPages)
    .values({
      ...input,
      id: randomUUID(),
      createdAt: now,
    })
    .returning()

  await db.update(notebooks).set({ updatedAt: now }).where(eq(notebooks.id, input.notebookId))

  return page
}

/** Replace the running understanding after a page was merged in. Caller has already checked ownership. */
export async function setDigest(notebookId: string, digest: string, model: string): Promise<void> {
  const now = new Date()

  await db
    .update(notebooks)
    .set({ digest, digestModel: model, updatedAt: now })
    .where(eq(notebooks.id, notebookId))
}

/** Returns false when no notebook matched this owner, so the route can 404 instead of pretending. */
export async function renameNotebook(id: string, asurite: string, name: string): Promise<boolean> {
  const trimmedName = name.trim() || 'New notebook'
  const [row] = await db
    .update(notebooks)
    .set({ name: trimmedName })
    .where(and(eq(notebooks.id, id), eq(notebooks.asurite, asurite)))
    .returning()

  return !!row
}

export async function deleteNotebook(id: string, asurite: string): Promise<boolean> {
  const [row] = await db
    .delete(notebooks)
    .where(and(eq(notebooks.id, id), eq(notebooks.asurite, asurite)))
    .returning()

  return !!row
}
