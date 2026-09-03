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
    <div className="flex min-h-svh justify-center bg-black">
      {/*
        Phone-width column below lg so it reads like the mobile app; full width
        above it, where the nav becomes a permanent rail and the thread is
        centred in its own container.
      */}
      <div className="relative flex h-svh w-full max-w-[430px] flex-col overflow-hidden bg-black lg:max-w-none lg:flex-row">
        <AppShell
          events={events}
          asurite={session?.asurite ?? null}
          railInitiallyOpen={railInitiallyOpen}
        />
      </div>
    </div>
  )
}
