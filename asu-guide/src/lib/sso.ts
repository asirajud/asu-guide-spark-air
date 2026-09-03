/**
 * Talks to a mock demo IdP, credentials are fake demo values.
 */
import { createHash, randomBytes } from 'node:crypto'

export const SSO_ISSUER = process.env.SSO_ISSUER ?? 'http://localhost:4000'
export const SSO_CLIENT_ID = process.env.SSO_CLIENT_ID ?? 'asu-guide-demo'
export const SSO_CLIENT_SECRET =
  process.env.SSO_CLIENT_SECRET ?? 'demo-secret-not-a-real-credential'
export const APP_URL = process.env.APP_URL ?? 'http://localhost:3001'
export const REDIRECT_URI = `${APP_URL}/api/auth/callback`
export const SCOPE = 'openid profile email'

export const PKCE_VERIFIER_COOKIE = 'sso_pkce_verifier'
export const OAUTH_STATE_COOKIE = 'sso_oauth_state'

export function createVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function authorizeUrl(state: string, challenge: string): string {
  const url = new URL('/authorize', SSO_ISSUER)
  url.searchParams.set('client_id', SSO_CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

export type SsoUser = {
  sub: string
  asurite: string
  email: string
  name: string
  affiliation: string
}

export async function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  const url = new URL('/api/token', SSO_ISSUER)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    client_id: SSO_CLIENT_ID,
    client_secret: SSO_CLIENT_SECRET,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to exchange code: ${res.status} ${text}`)
  }

  const json = await res.json()
  return json as TokenResponse
}

export async function fetchUserInfo(accessToken: string): Promise<SsoUser> {
  const url = new URL('/api/userinfo', SSO_ISSUER)

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to fetch user info: ${res.status} ${text}`)
  }

  const json = await res.json()
  return json as SsoUser
}
