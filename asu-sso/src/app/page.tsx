import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sol — Demo Identity Provider',
}

export default function Home() {
  return (
    <>
      <div className="w-full bg-asu-maroon">
        <h1 className="mx-auto max-w-2xl px-6 py-5 text-[22px] font-bold tracking-tight text-white">
          Sol — Demo Identity Provider
        </h1>
      </div>
      <main className="mx-auto w-full max-w-2xl px-6 py-10 space-y-6">
        <div className="rounded-lg border-l-4 border-[#C77700] bg-[#FFF4D6] px-5 py-4 text-[#7A4A00]">
          <p className="text-[13px] font-extrabold uppercase tracking-wide">
            Demo identity provider
          </p>
          <p className="mt-1 text-[14px] font-semibold leading-snug">
            This is a mock sign-in service for the ASU AIR Spark Challenge. It is NOT a real ASU
            login, it is not connected to Arizona State University, and no password is ever checked.
            Do not enter your real ASURITE password here or anywhere that looks like this.
          </p>
        </div>
        <div className="rounded-lg border border-asu-line bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-bold">What this is</h2>
          <p className="mt-3 text-[14px] leading-snug">
            This implements a real OAuth 2.0 authorization-code flow with PKCE (S256) so the
            handshake with the demo Sol app at http://localhost:3001 is genuine, while the identity
            itself is fake — any ASURITE is accepted and the password field is decorative.
          </p>
        </div>
        <div className="rounded-lg border border-asu-line bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-bold">Endpoints</h2>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li>
              <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
                GET /authorize
              </code>{' '}
              — Authorization endpoint
            </li>
            <li>
              <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
                POST /api/login
              </code>{' '}
              — Login endpoint
            </li>
            <li>
              <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
                POST /api/token
              </code>{' '}
              — Token endpoint
            </li>
            <li>
              <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
                GET /api/userinfo
              </code>{' '}
              — User info endpoint
            </li>
            <li>
              <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
                GET /api/logout
              </code>{' '}
              — Logout endpoint
            </li>
            <li>
              <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
                GET /.well-known/openid-configuration
              </code>{' '}
              — OpenID Connect configuration endpoint
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-asu-line bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-bold">Demo credentials (fake, on purpose)</h2>
          <p className="mt-3 text-[14px]">
            <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
              client_id: asu-guide-demo
            </code>
          </p>
          <p className="mt-1 text-[14px]">
            <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
              client_secret: demo-secret-not-a-real-credential
            </code>
          </p>
          <p className="mt-1 text-[14px]">
            <code className="rounded bg-asu-bg px-1.5 py-0.5 font-mono text-[13px]">
              redirect_uri: http://localhost:3001/api/auth/callback
            </code>
          </p>
          <p className="mt-3 text-[14px] text-asu-muted">
            These credentials are committed deliberately and are not real ASU credentials.
          </p>
        </div>
        <p className="text-[14px] text-asu-muted">
          All codes, tokens and sessions live in a plain in-memory Map and are lost whenever the
          server restarts.
        </p>
      </main>
    </>
  )
}
