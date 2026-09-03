import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin'
import { CONFIGURABLE } from '@/lib/air/capabilities'
import { MODELS, type AirService } from '@/lib/air/models'
import { clearModel, orderFor, readOverrides, setModel } from '@/lib/air/settings'

export const runtime = 'nodejs'

function snapshot() {
  const overrides = readOverrides()
  return {
    slots: [...CONFIGURABLE].map((service) => ({
      service,
      chosen: overrides.get(service)?.model ?? null,
      updatedBy: overrides.get(service)?.updatedBy ?? null,
      updatedAt: overrides.get(service)?.updatedAt ?? null,
      /** The compiled-in preference order, shown as "Recommended" in the UI. */
      recommended: MODELS[service] ?? [],
      /** What the runner will actually try, in order. */
      order: orderFor(service),
    })),
  }
}

export async function GET() {
  if (!(await adminSession())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  return NextResponse.json(snapshot())
}

export async function PUT(req: Request) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as {
    service?: string
    model?: string | null
  } | null

  const service = body?.service as AirService | undefined
  // Only services the dashboard actually exposes; an unknown name would write a
  // row the runner never reads and silently look like it had been saved.
  if (!service || !CONFIGURABLE.has(service)) {
    return NextResponse.json({ error: 'Unknown capability.' }, { status: 400 })
  }

  if (body?.model == null || body.model === '') clearModel(service)
  else if (typeof body.model === 'string') setModel(service, body.model.trim(), admin.asurite)
  else return NextResponse.json({ error: 'Expected a model id or null.' }, { status: 400 })

  return NextResponse.json(snapshot())
}
