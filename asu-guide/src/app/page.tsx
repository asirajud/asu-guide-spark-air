import { AppShell } from '@/components/app-shell'
import { getDemoEvents } from '@/lib/events'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [events, session] = await Promise.all([getDemoEvents(5), getSession()])

  return (
    <div className="flex min-h-svh justify-center bg-black">
      {/* Phone-width column so it reads like the mobile app on a laptop */}
      <div className="relative flex h-svh w-full max-w-[430px] flex-col overflow-hidden bg-black">
        <AppShell events={events} asurite={session?.asurite ?? null} />
      </div>
    </div>
  )
}
