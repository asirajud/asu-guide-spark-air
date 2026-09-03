import 'server-only'

import { getSession, type SessionUser } from '@/lib/session'

/**
 * Staff run the dashboard. The demo IdP seeds exactly one — admin/admin, marked
 * Staff — and affiliation is inside the HMAC-signed session, so it cannot be
 * edited client-side into a promotion.
 */
export function isAdmin(user: SessionUser | null): boolean {
  return user?.affiliation === 'Staff'
}

/** Null when the caller is not a signed-in admin; the page or route decides what that means. */
export async function adminSession(): Promise<SessionUser | null> {
  const user = await getSession()
  return isAdmin(user) ? user : null
}
