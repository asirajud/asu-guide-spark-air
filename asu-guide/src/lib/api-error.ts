import 'server-only'

/**
 * Turn a thrown error into something safe to hand a browser.
 *
 * The detail stays in the server log where it is useful for debugging; the
 * client gets a short sentence that says what to try next. Gateway error bodies
 * in particular can carry model names, internal hostnames and request shapes
 * that a user has no business seeing.
 */
export function safeError(where: string, err: unknown, fallback: string): string {
  const detail = err instanceof Error ? err.message : String(err)
  console.error(`[${where}]`, detail)

  // Two conditions the user can actually act on, so they are worth surfacing.
  if (/timeout|abort|ETIMEDOUT/i.test(detail)) {
    return 'That took too long. Check the ASU VPN and try again.'
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(detail)) {
    return 'Could not reach the ASU AIR gateway — is the VPN connected?'
  }

  return fallback
}
