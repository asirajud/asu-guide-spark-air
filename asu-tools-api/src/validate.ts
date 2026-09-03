/**
 * Every tools/call argument set is checked against the schema the registry publishes for that
 * tool BEFORE anything is dispatched. A model that gets a bare 500 has nothing to act on; a
 * model that is told which field was wrong and why will usually fix it on the next turn, so the
 * error envelope names the field, the rule it broke, and what was expected.
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'
import type { ToolSpec } from './registry.js'

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false })
addFormats(ajv)

const cache = new Map<string, ValidateFunction>()   // keyed by tool name

export type FieldError = { field: string; rule: string; message: string; expected?: unknown }

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: FieldError[]; summary: string }

export function compileFor(tool: ToolSpec): ValidateFunction {
  const existing = cache.get(tool.name)
  if (existing) {
    return existing
  }

  try {
    const compiled = ajv.compile(tool.inputSchema)
    cache.set(tool.name, compiled)
    return compiled
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to compile schema for tool "${tool.name}": ${message}`, { cause: err })
  }
}

export function clearValidatorCache(): void {
  cache.clear()
}

function fieldPathOf(err: ErrorObject): string {
  if (err.instancePath) {
    return err.instancePath.substring(1).replace(/\//g, '.')
  }

  if (err.keyword === 'required' && typeof err.params.missingProperty === 'string') {
    return err.params.missingProperty
  }

  if (err.keyword === 'additionalProperties' && typeof err.params.additionalProperty === 'string') {
    return err.params.additionalProperty
  }

  return '(root)'
}

function messageOf(err: ErrorObject): string {
  const field = fieldPathOf(err)
  switch (err.keyword) {
    case 'required': {
      return `"${field}" is required.`
    }
    case 'additionalProperties': {
      return `"${field}" is not a parameter of this tool.`
    }
    case 'type': {
      return `"${field}" must be of type ${err.params.type}.`
    }
    case 'minimum': {
      return `"${field}" must be at least ${err.params.limit}.`
    }
    case 'maximum': {
      return `"${field}" must be at most ${err.params.limit}.`
    }
    case 'exclusiveMinimum': {
      return `"${field}" must be greater than ${err.params.limit}.`
    }
    case 'exclusiveMaximum': {
      return `"${field}" must be less than ${err.params.limit}.`
    }
    case 'minLength': {
      return `"${field}" must be at least ${err.params.limit} characters.`
    }
    case 'maxLength': {
      return `"${field}" must be at most ${err.params.limit} characters.`
    }
    case 'enum': {
      const allowed = (err.params.allowedValues || []).join(', ')
      return `"${field}" must be one of: ${allowed}.`
    }
    default: {
      return `"${field}" ${err.message}.`
    }
  }
}

export function validateArgs(tool: ToolSpec, args: unknown): ValidationResult {
  if (args === null || args === undefined || Array.isArray(args) || typeof args !== 'object') {
    return {
      ok: false,
      errors: [{
        field: '(root)',
        rule: 'type',
        message: 'Arguments must be a JSON object.'
      }],
      summary: 'Arguments must be a JSON object.'
    }
  }

  const validate = compileFor(tool)
  const isValid = validate(args)

  if (isValid) {
    return { ok: true }
  }

  const errors: FieldError[] = []
  const seen = new Set<string>()

  for (const err of validate.errors!) {
    const field = fieldPathOf(err)
    const rule = err.keyword
    const key = `${field}|${rule}`
    
    if (seen.has(key)) {
      continue
    }
    
    seen.add(key)
    
    errors.push({
      field,
      rule,
      message: messageOf(err),
      expected: err.params
    })
  }

  const summary = errors.map(e => e.message).join(' ')

  return { ok: false, errors, summary }
}

export function describeSchema(tool: ToolSpec): string {
  const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: unknown }
  const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : []

  if (!props || typeof props !== 'object') {
    return '(no parameters)'
  }

  const parts: string[] = []
  for (const [name, prop] of Object.entries(props)) {
    const type = prop && typeof prop === 'object' && 'type' in prop
      ? String((prop as { type?: unknown }).type ?? 'any')
      : 'any'
    const requiredParam = required.includes(name) ? 'required' : 'optional'
    parts.push(`${name} (${type}, ${requiredParam})`)
  }

  return parts.length ? parts.join(', ') : '(no parameters)'
}