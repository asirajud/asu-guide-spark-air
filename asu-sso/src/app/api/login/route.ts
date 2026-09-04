/**
 * Demo IdP login. Credentials ARE verified now, against a local store of
 * fictional accounts (see src/lib/users.ts) — but this is still not connected
 * to ASU's directory, and no real ASURITE password will ever work here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getClient, isValidRedirectUri } from '@/lib/clients'
import { issueCode, normalizeAsurite, randomId, sessions } from '@/lib/store'
import { verifyUser } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const f = (k: string) => String(form.get(k) ?? '').trim()

  const password = f('password')
  const client_id = f('client_id')
  const redirect_uri = f('redirect_uri')
  const response_type = f('response_type')
  const state = f('state')
  const code_challenge = f('code_challenge')
  const code_challenge_method = f('code_challenge_method')
  const scope = f('scope')
  const asurite = f('asurite')

  const client = getClient(client_id)
  if (!client) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid client_id' },
      { status: 400 },
    )
  }

  if (!isValidRedirectUri(client, redirect_uri)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid redirect_uri' },
      { status: 400 },
    )
  }

  if (!code_challenge) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'code_challenge is required' },
      { status: 400 },
    )
  }

  if (code_challenge_method !== 'S256') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Unsupported code_challenge_method' },
      { status: 400 },
    )
  }

  if (!state) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'state is required' },
      { status: 400 },
    )
  }

  const normalizedAsurite = normalizeAsurite(asurite)

  // One failure message for a bad username and a bad password alike, so the
  // form cannot be used to enumerate which accounts exist.
  const user = normalizedAsurite ? verifyUser(normalizedAsurite, password) : null

  if (!user) {
    // Redirect back to the sign-in page with an error
    const url = new URL('/authorize', req.url)
    url.searchParams.set('error', 'invalid_credentials')
    url.searchParams.set(
      'error_description',
      'That ASURITE and password combination was not recognised.',
    )
    // Copy all OAuth params back
    url.searchParams.set('client_id', client_id)
    url.searchParams.set('redirect_uri', redirect_uri)
    // Every param /authorize validates has to be copied back, or the retry
    // after a wrong password lands on "Unsupported response_type".
    url.searchParams.set('response_type', response_type)
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', code_challenge)
    url.searchParams.set('code_challenge_method', code_challenge_method)
    url.searchParams.set('scope', scope)
    return NextResponse.redirect(url.toString(), 303)
  }

  const record = issueCode({
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    codeChallengeMethod: 'S256',
    scope: scope || 'openid profile email',
    state,
    asurite: normalizedAsurite,
  })

  const target = new URL(redirect_uri)
  target.searchParams.set('code', record.code)
  target.searchParams.set('state', state)

  const sid = randomId(24)
  sessions.set(sid, normalizedAsurite)

  const res = NextResponse.redirect(target.toString(), 303)
  res.cookies.set('sso_session', sid, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  return res
}
