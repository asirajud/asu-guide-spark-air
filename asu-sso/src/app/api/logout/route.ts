import { NextRequest, NextResponse } from 'next/server'
import { sessions } from '@/lib/store'
import { isAllowedRedirectOrigin } from '@/lib/clients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sid = req.cookies.get('sso_session')?.value
  if (sid) {
    sessions.delete(sid)
  }

  const { searchParams } = new URL(req.url)
  const redirectUri = searchParams.get('redirect_uri') || ''

  let res: NextResponse

  // Validate against the origins of registered clients rather than a hardcoded
  // port list — an app that moves ports should not strand the user on JSON,
  // and an unregistered origin must not be usable as an open redirect.
  if (redirectUri && isAllowedRedirectOrigin(redirectUri)) {
    res = NextResponse.redirect(redirectUri, 303)
  } else {
    res = NextResponse.json({
      ok: true,
      message: 'Demo IdP session cleared.',
    })
  }

  res.cookies.set('sso_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return res
}

export const POST = GET
