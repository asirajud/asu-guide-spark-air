import fs from 'node:fs'
import path from 'node:path'

export type ToolRoute = { method: 'GET' | 'POST'; path: string }

export type ToolSpec = {
  name: string
  description: string
  route: ToolRoute
  /** JSON Schema (draft 2020-12 compatible subset) for this tool's arguments. */
  inputSchema: Record<string, unknown>
}

export type ServiceSpec = {
  id: string
  description: string
  baseUrl: string
  healthPath: string
  contractVersion: string
  tools: ToolSpec[]
}

export type RegisteredTool = { service: ServiceSpec; tool: ToolSpec }

const SEED_FILE = path.resolve(process.cwd(), 'services.json')
const RUNTIME_FILE = path.resolve(process.cwd(), process.env.REGISTRY_FILE ?? 'registry.json')

let cachedServices: ServiceSpec[] | null = null

export class ContractError extends Error {}

export function validateServiceSpec(input: unknown): ServiceSpec {
  if (input === null || typeof input !== 'object') {
    throw new ContractError('service must be an object')
  }

  const service = input as Partial<ServiceSpec>

  if (
    typeof service.id !== 'string' ||
    service.id.length === 0 ||
    !/^[a-z0-9][a-z0-9-]{1,63}$/.test(service.id)
  ) {
    throw new ContractError('id must be a non-empty string matching /^[a-z0-9][a-z0-9-]{1,63}$/')
  }

  if (typeof service.description !== 'string' || service.description.length === 0) {
    throw new ContractError('description must be a non-empty string')
  }

  if (typeof service.baseUrl !== 'string') {
    throw new ContractError('baseUrl must be a string')
  }

  try {
    const url = new URL(service.baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ContractError('baseUrl must parse as a URL with protocol http: or https:')
    }
  } catch {
    throw new ContractError('baseUrl must parse as a URL with protocol http: or https:')
  }

  if (typeof service.healthPath !== 'string' || !service.healthPath.startsWith('/')) {
    throw new ContractError('healthPath must be a string starting with "/"')
  }

  if (
    typeof service.contractVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(service.contractVersion)
  ) {
    throw new ContractError('contractVersion must be a semantic version string like "1.0.0"')
  }

  if (!Array.isArray(service.tools) || service.tools.length === 0) {
    throw new ContractError('tools must be an array with at least one entry')
  }

  const toolNames = new Set<string>()
  for (let i = 0; i < service.tools.length; i++) {
    const tool = service.tools[i]
    if (typeof tool !== 'object' || tool === null) {
      throw new ContractError(`tools[${i}] must be an object`)
    }

    if (typeof tool.name !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(tool.name)) {
      throw new ContractError(`tools[${i}].name must match /^[a-z][a-z0-9_]{1,63}$/`)
    }

    if (toolNames.has(tool.name)) {
      throw new ContractError(`tools[${i}].name must be unique within the service`)
    }
    toolNames.add(tool.name)

    if (typeof tool.description !== 'string' || tool.description.length === 0) {
      throw new ContractError(`tools[${i}].description must be a non-empty string`)
    }

    if (typeof tool.route !== 'object' || tool.route === null) {
      throw new ContractError(`tools[${i}].route must be an object`)
    }

    if (
      typeof tool.route.method !== 'string' ||
      (tool.route.method !== 'GET' && tool.route.method !== 'POST')
    ) {
      throw new ContractError(`tools[${i}].route.method must be GET or POST`)
    }

    if (typeof tool.route.path !== 'string' || !tool.route.path.startsWith('/')) {
      throw new ContractError(`tools[${i}].route.path must be a string starting with "/"`)
    }

    if (typeof tool.inputSchema !== 'object' || tool.inputSchema === null) {
      throw new ContractError(`tools[${i}].inputSchema must be a non-null object`)
    }

    if (typeof tool.inputSchema.type !== 'string' || tool.inputSchema.type !== 'object') {
      throw new ContractError(`tools[${i}].inputSchema.type must be the string 'object'`)
    }
  }

  return service as ServiceSpec
}

function loadFromDisk(): ServiceSpec[] {
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'))
  } catch {
    throw new ContractError('Failed to read seed file')
  }

  const rawRecord = raw as Record<string, unknown>
  if (typeof rawRecord !== 'object' || rawRecord === null || !Array.isArray(rawRecord.services)) {
    throw new ContractError('Seed file must contain a services array')
  }

  const services: ServiceSpec[] = []
  const servicesArray = rawRecord.services as unknown[]
  for (let i = 0; i < servicesArray.length; i++) {
    try {
      services.push(validateServiceSpec(servicesArray[i]))
    } catch (err) {
      throw new ContractError(`services[${i}] ${err instanceof Error ? err.message : 'invalid'}`)
    }
  }

  // Save to runtime file if it doesn't exist yet
  if (!fs.existsSync(RUNTIME_FILE)) {
    saveRegistry(services)
  }

  return services
}

export function loadRegistry(): ServiceSpec[] {
  if (cachedServices !== null) {
    return cachedServices
  }

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf-8'))
  } catch {
    // Fall back to seed file
    return loadFromDisk()
  }

  const rawRecord = raw as Record<string, unknown>
  if (typeof rawRecord !== 'object' || rawRecord === null || !Array.isArray(rawRecord.services)) {
    throw new ContractError('Runtime file must contain a services array')
  }

  const services: ServiceSpec[] = []
  const servicesArray = rawRecord.services as unknown[]
  for (let i = 0; i < servicesArray.length; i++) {
    try {
      services.push(validateServiceSpec(servicesArray[i]))
    } catch (err) {
      throw new ContractError(`services[${i}] ${err instanceof Error ? err.message : 'invalid'}`)
    }
  }

  cachedServices = services
  return cachedServices
}

export function saveRegistry(services: ServiceSpec[]): void {
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify({ services }, null, 2))
  cachedServices = services
}

export function listServices(): ServiceSpec[] {
  return loadRegistry()
}

export function upsertService(input: unknown): { service: ServiceSpec; created: boolean } {
  const service = validateServiceSpec(input)
  const services = loadRegistry()
  const existingIndex = services.findIndex((s) => s.id === service.id)

  if (existingIndex !== -1) {
    services[existingIndex] = service
    saveRegistry(services)
    return { service, created: false }
  } else {
    services.push(service)
    saveRegistry(services)
    return { service, created: true }
  }
}

export function removeService(id: string): boolean {
  const services = loadRegistry()
  const initialLength = services.length
  const filtered = services.filter((s) => s.id !== id)
  if (filtered.length === initialLength) {
    return false
  }
  saveRegistry(filtered)
  return true
}

export function findTool(name: string): RegisteredTool | null {
  const services = loadRegistry()
  for (const service of services) {
    for (const tool of service.tools) {
      if (tool.name === name) {
        return { service, tool }
      }
    }
  }
  return null
}

export function allTools(): RegisteredTool[] {
  const services = loadRegistry()
  const tools: RegisteredTool[] = []
  for (const service of services) {
    for (const tool of service.tools) {
      tools.push({ service, tool })
    }
  }
  return tools
}

export function reloadRegistry(): void {
  cachedServices = null
}

/**
 * The session tool budget lives here as data, not code: SESSION_TOOLS names the tools that are
 * exposed to a chat model at session start. Everything else is reachable only through
 * list_capabilities, so the per-turn prompt cost stays flat as the registry grows.
 */
export const SESSION_TOOLS = [
  'search_events',
  'get_event_details',
  'reserve_spot',
  'web_search',
  'plan_heat_route',
]
