import { AppShell } from '@/components/app-shell'
import { getDemoEvents } from '@/lib/events'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [events, session, jar] = await Promise.all([getDemoEvents(5), getSession(), cookies()])
  // Rendered server-side so a collapsed rail never flashes open on reload.
  const railInitiallyOpen = jar.get('asu-guide-rail')?.value !== '0'

  return (
    /*
      Fluid at every width: the shell always fills the viewport and the pieces
      inside do their own constraining — the thread centres itself at 820px, the
      nav is an overlay drawer below lg and a fixed-width rail above it. Capping
      the shell instead would letterbox the rail layout on a wide monitor.
    */
    <div className="relative flex h-svh w-full flex-col overflow-hidden bg-black lg:flex-row">
      <AppShell
        events={events}
        asurite={session?.asurite ?? null}
        railInitiallyOpen={railInitiallyOpen}
      />
    </div>
  )
}
