import { cookies } from 'next/headers'
import SignInCard from '@/components/sign-in-card'
import { getClient, isValidRedirectUri } from '@/lib/clients'
import { sessions } from '@/lib/store'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const one = (k: string): string => {
    const v = sp[k]
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
  }

  const client_id = one('client_id')
  const redirect_uri = one('redirect_uri')
  const response_type = one('response_type')
  const state = one('state')
  const code_challenge = one('code_challenge')
  const code_challenge_method = one('code_challenge_method')
  const scope = one('scope') || 'openid profile email'

  // Validate parameters
  const client = getClient(client_id)
  if (!client_id || !client) {
    return (
      <RequestError
        message={`Unknown client_id "${client_id}". This demo IdP only knows the client registered in clients.json.`}
      />
    )
  }

  if (!redirect_uri || !isValidRedirectUri(client, redirect_uri)) {
    return (
      <RequestError message={`redirect_uri "${redirect_uri}" is not registered for this client.`} />
    )
  }

  if (response_type !== 'code') {
    return (
      <RequestError
        message={`Unsupported response_type "${response_type}". This server only supports the authorization code flow.`}
      />
    )
  }

  if (!code_challenge) {
    return <RequestError message="Missing code_challenge. PKCE is required." />
  }

  if (code_challenge_method !== 'S256') {
    return (
      <RequestError
        message={`Unsupported code_challenge_method "${code_challenge_method}". Only S256 is supported.`}
      />
    )
  }

  if (!state) {
    return <RequestError message="Missing state parameter." />
  }

  // Read session cookie to prefill the field
  const jar = await cookies()
  const sid = jar.get('sso_session')?.value
  const defaultAsurite = sid ? (sessions.get(sid) ?? '') : ''

  return (
    <SignInCard
      clientId={client_id}
      redirectUri={redirect_uri}
      responseType={response_type}
      state={state}
      codeChallenge={code_challenge}
      codeChallengeMethod={code_challenge_method}
      scope={scope}
      clientName={client.name}
      defaultAsurite={defaultAsurite}
    />
  )
}

function RequestError({ message }: { message: string }) {
  return (
    <>
      <div className="bg-asu-maroon h-14 w-full"></div>
      <main className="mx-auto w-full max-w-md px-6 py-10">
        <div className="rounded-lg border border-asu-line bg-white p-6 shadow-sm">
          <h2 className="text-[20px] font-bold text-asu-ink">Invalid authorization request</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-asu-muted">{message}</p>
        </div>
      </main>
    </>
  )
}
