type SignInCardProps = {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  codeChallengeMethod: string
  scope: string
  clientName: string
  defaultAsurite?: string
  error?: string
}

export default function SignInCard(props: SignInCardProps) {
  return (
    <>
      <div className="w-full bg-asu-maroon">
        <h1 className="mx-auto max-w-md px-6 py-5 text-[22px] font-bold tracking-tight text-white">
          Sol — Demo Sign In
        </h1>
      </div>
      <main className="mx-auto w-full max-w-md px-6 py-10">
        <div className="overflow-hidden rounded-lg border border-asu-line bg-white shadow-sm">
          <div className="border-b-4 border-[#C77700] bg-[#FFF4D6] px-6 py-4 text-[#7A4A00]">
            <p className="text-[13px] font-extrabold uppercase tracking-wide">
              Demo identity provider
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-snug">
              This is a mock sign-in for the ASU AIR Spark Challenge. It is NOT a real ASU login. Do
              not enter your real ASURITE password.
            </p>
          </div>
          <div className="px-6 py-7">
            <h2 className="text-[26px] font-bold text-asu-ink">Sign In</h2>
            <p className="mt-1 text-[13px] text-asu-muted">
              {props.clientName} is requesting access to your demo profile.
            </p>
            {props.error && (
              <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                {props.error}
              </p>
            )}
            <form method="post" action="/api/login" className="mt-6 space-y-5">
              <input type="hidden" name="client_id" value={props.clientId} />
              <input type="hidden" name="redirect_uri" value={props.redirectUri} />
              <input type="hidden" name="state" value={props.state} />
              <input type="hidden" name="code_challenge" value={props.codeChallenge} />
              <input type="hidden" name="code_challenge_method" value={props.codeChallengeMethod} />
              <input type="hidden" name="scope" value={props.scope} />
              <div>
                <label htmlFor="asurite" className="block text-[13px] font-semibold text-asu-ink">
                  ASURITE User ID
                </label>
                <input
                  id="asurite"
                  name="asurite"
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  defaultValue={props.defaultAsurite ?? ''}
                  className="mt-1.5 block w-full rounded border border-asu-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-asu-maroon focus:ring-2 focus:ring-asu-maroon/25"
                />
                <p className="mt-1.5 text-[12px] text-asu-muted">
                  Any value is accepted — this is a demo. Try{' '}
                  <span className="font-mono">asirajud</span>.
                </p>
              </div>
              <div>
                <label htmlFor="password" className="block text-[13px] font-semibold text-asu-ink">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="off"
                  className="mt-1.5 block w-full rounded border border-asu-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-asu-maroon focus:ring-2 focus:ring-asu-maroon/25"
                />
                <p className="mt-1.5 text-[12px] text-asu-muted">
                  Checked against a local store of fictional demo accounts. Try{' '}
                  <span className="font-semibold">admin</span> /{' '}
                  <span className="font-semibold">admin</span>. No real ASU password will ever work
                  here.
                </p>
              </div>
              <button
                type="submit"
                className="w-full rounded bg-asu-maroon px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-asu-maroon-dark focus:outline-none focus:ring-2 focus:ring-asu-gold"
              >
                Sign In
              </button>
            </form>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-asu-line pt-4 text-[12px] text-asu-muted">
              <span
                className="cursor-default underline decoration-dotted underline-offset-2"
                title="Inactive — demo page"
              >
                Forgot ASURITE ID?
              </span>
              <span
                className="cursor-default underline decoration-dotted underline-offset-2"
                title="Inactive — demo page"
              >
                Activate ASURITE
              </span>
              <span
                className="cursor-default underline decoration-dotted underline-offset-2"
                title="Inactive — demo page"
              >
                Help
              </span>
              <span
                className="cursor-default underline decoration-dotted underline-offset-2"
                title="Inactive — demo page"
              >
                Privacy
              </span>
            </div>
          </div>
        </div>
      </main>
      <p className="mt-6 text-center text-[12px] leading-relaxed text-asu-muted">
        Mock OAuth 2.0 identity provider built for the ASU AIR Spark Challenge. Credentials are
        checked against a local store of fictional demo accounts and never leave this machine. Not
        affiliated with, endorsed by, or connected to Arizona State University&rsquo;s real sign-in
        service.
      </p>
    </>
  )
}
