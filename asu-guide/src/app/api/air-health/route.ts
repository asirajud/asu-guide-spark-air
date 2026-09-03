import { NextResponse } from 'next/server'
import { db } from '@/db'
import { modelHealth } from '@/db/schema'
import { MODELS } from '@/lib/air/models'

export const runtime = 'nodejs'

/** Which models are currently benched, and what the fallback order looks like. */
export async function GET() {
  const rows = await db.select().from(modelHealth)
  const now = Date.now()

  return NextResponse.json({
    services: MODELS,
    benched: rows
      .filter((r) => r.disabledUntil.getTime() > now)
      .map((r) => ({
        model: r.model,
        service: r.service,
        reason: r.reason,
        status: r.status,
        until: r.disabledUntil,
      })),
  })
}

/** Clear the bench — useful after the gateway recovers. */
export async function DELETE() {
  await db.delete(modelHealth)
  return NextResponse.json({ ok: true })
}
