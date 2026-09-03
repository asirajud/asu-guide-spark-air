import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin'
import { getTools, TOOLS_BASE } from '@/lib/tools'
import { setToolEnabled, toolAudit } from '@/lib/tool-settings'

export const runtime = 'nodejs'

type RegistryTool = { name: string; description?: string; route?: { method: string; path: string } }
type RegistryService = {
  id: string
  description?: string
  baseUrl: string
  contractVersion?: string
  tools: RegistryTool[]
}
type Health = { id?: string; healthy?: boolean; ms?: number }

async function snapshot() {
  const audit = toolAudit()

  let services: RegistryService[] = []
  let health: Health[] = []
  let error: string | null = null

  try {
    const res = await fetch(`${TOOLS_BASE}/registry/services`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`asu-tools-api answered ${res.status}.`)
    const body = (await res.json()) as { services?: RegistryService[]; health?: Health[] }
    services = body.services ?? []
    health = body.health ?? []
  } catch (err) {
    // The registry being down is a state to render, not a 500 — the dashboard
    // should say "the tool service is not running", not fail to load.
    error = err instanceof Error ? err.message : 'asu-tools-api could not be reached.'
  }

  // Keyed by id, not by position: the two arrays happen to line up today, and
  // an off-by-one here would report one service's health against another's.
  const byId = new Map(health.map((h) => [h.id, h]))

  // What the chat route will actually put in front of the model on the next
  // turn — the answer to "did that switch do anything", read from the same
  // function the model is served by rather than recomputed here.
  const effective = (await getTools()).map((t) => t.function.name)

  return {
    error,
    effective,
    services: services.map((s) => ({
      id: s.id,
      description: s.description ?? '',
      baseUrl: s.baseUrl,
      contractVersion: s.contractVersion ?? '',
      healthy: byId.get(s.id)?.healthy ?? null,
      latencyMs: byId.get(s.id)?.ms ?? null,
      tools: s.tools.map((t) => ({
        name: t.name,
        description: t.description ?? '',
        method: t.route?.method ?? '',
        path: t.route?.path ?? '',
        // Absence means enabled, so a newly registered tool is live by default.
        enabled: audit.get(t.name)?.enabled ?? true,
        updatedBy: audit.get(t.name)?.updatedBy ?? null,
      })),
    })),
  }
}

export async function GET() {
  if (!(await adminSession())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  return NextResponse.json(await snapshot())
}

export async function PUT(req: Request) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as {
    name?: string
    enabled?: boolean
  } | null

  if (typeof body?.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Expected a tool name.' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Expected enabled to be true or false.' }, { status: 400 })
  }

  setToolEnabled(body.name.trim(), body.enabled, admin.asurite)
  return NextResponse.json(await snapshot())
}
