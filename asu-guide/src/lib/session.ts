// This cookie is HMAC-signed but NOT encrypted, so it is tamper-evident rather than secret.
// This is a demo implementation.
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SsoUser } from '@/lib/sso'

export const SESSION_COOKIE = 'asu_guide_session'
export const SESSION_MAX_AGE = 60 * 60 * 8 // 8 hours

export type SessionUser = SsoUser

export function secret(): string {
  return process.env.SESSION_SECRET ?? 'demo-session-secret-not-a-real-credential'
}

export function signSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url')
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifySession(raw: string | undefined): SessionUser | null {
  if (!raw) return null

  try {
    const lastDot = raw.lastIndexOf('.')
    if (lastDot === -1) return null

    const payload = raw.slice(0, lastDot)
    const sig = raw.slice(lastDot + 1)

    if (!payload || !sig) return null

    const expectedSig = createHmac('sha256', secret()).update(payload).digest('base64url')

    const expectedBuffer = Buffer.from(expectedSig, 'base64url')
    const actualBuffer = Buffer.from(sig, 'base64url')

    if (expectedBuffer.length !== actualBuffer.length) return null

    if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null

    const userJson = Buffer.from(payload, 'base64url').toString('utf-8')
    const user = JSON.parse(userJson)

    if (
      typeof user !== 'object' ||
      user === null ||
      typeof user.asurite !== 'string' ||
      typeof user.sub !== 'string'
    ) {
      return null
    }

    return user as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  return verifySession(jar.get(SESSION_COOKIE)?.value)
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
  secure: process.env.NODE_ENV === 'production',
}
