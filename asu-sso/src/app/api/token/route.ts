// demo token endpoint, id_token is unsigned JSON on purpose, tokens live in process memory only
import { NextRequest, NextResponse } from 'next/server'
import { getClient, isValidRedirectUri, checkClientSecret } from '@/lib/clients'
import { consumeCode, issueToken, makeUser, verifyPkce, TOKEN_TTL_S } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Parse request body based on content type
  let body: Record<string, string>
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const json: unknown = await req.json()
    body = typeof json === 'object' && json !== null ? (json as Record<string, string>) : {}
  } else {
    const formData = await req.formData()
    const entries: Record<string, string> = {}
    formData.forEach((value, key) => {
      if (typeof value === 'string') entries[key] = value
    })
    body = entries
  }

  const b = (k: string) => String(body[k] ?? '').trim()

  // Handle client authentication (HTTP Basic or form fields)
  let client_id: string
  let client_secret: string

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    const base64Credentials = authHeader.substring(6)
    const credentials = atob(base64Credentials)
    const [id, secret] = credentials.split(':', 2)
    client_id = decodeURIComponent(id)
    client_secret = decodeURIComponent(secret)
  } else {
    client_id = b('client_id')
    client_secret = b('client_secret')
  }

  // Helper for error responses
  const fail = (status: number, error: string, description: string) =>
    NextResponse.json(
      { error, error_description: description },
      { status, headers: { 'Cache-Control': 'no-store' } },
    )

  // Validation
  if (b('grant_type') !== 'authorization_code') {
    return fail(400, 'unsupported_grant_type', 'Invalid grant type.')
  }

  const code = b('code')
  const code_verifier = b('code_verifier')
  const redirect_uri = b('redirect_uri')

  if (!code) {
    return fail(400, 'invalid_request', 'Missing code.')
  }

  if (!code_verifier) {
    return fail(400, 'invalid_request', 'Missing code_verifier. PKCE is required.')
  }

  const client = getClient(client_id)
  if (!client) {
    return fail(401, 'invalid_client', 'Unknown client.')
  }

  if (!checkClientSecret(client, client_secret)) {
    return fail(401, 'invalid_client', 'Bad client secret.')
  }

  if (!redirect_uri || !isValidRedirectUri(client, redirect_uri)) {
    return fail(400, 'invalid_grant', 'redirect_uri mismatch.')
  }

  // Consume the authorization code
  const consumed = consumeCode(code, client_id, redirect_uri)
  if (!consumed.ok) {
    return fail(
      400,
      'invalid_grant',
      'Authorization code is invalid, expired, or has already been used.',
    )
  }

  // PKCE verification (must happen after code consumption)
  if (!verifyPkce(code_verifier, consumed.record.codeChallenge)) {
    return fail(
      400,
      'invalid_grant',
      'PKCE verification failed: code_verifier does not match code_challenge.',
    )
  }

  // Issue token and create user
  const token = issueToken(consumed.record.asurite, client_id, consumed.record.scope)
  const user = makeUser(consumed.record.asurite)

  // Return token response
  return NextResponse.json(
    {
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_S,
      scope: consumed.record.scope,
      id_token: {
        iss: process.env.SSO_ISSUER ?? 'http://localhost:4000',
        aud: client_id,
        sub: user.sub,
        asurite: user.asurite,
        email: user.email,
        name: user.name,
        affiliation: user.affiliation,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S,
        _note:
          'Demo only: this is a plain JSON object, NOT a signed JWT. Do not treat it as verifiable.',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
