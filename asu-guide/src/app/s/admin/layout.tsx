import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/admin/nav'
import { isAdmin } from '@/lib/admin'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Gate and chrome for every admin page.
 *
 * The check lives here rather than in each page so a section added later cannot
 * ship unprotected by forgetting to repeat it. Route handlers under
 * /api/admin/* still check for themselves — a layout guards navigation, not the
 * endpoints the browser can call directly.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/api/auth/login')
  if (!isAdmin(session)) redirect('/')

  return (
    <div className="min-h-svh bg-black">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-black/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-6 py-4">
          <Image src="/mark-brain.png" alt="" width={24} height={24} className="size-6" />
          <span className="text-[17px] font-medium tracking-[-0.02em] text-white">Sol</span>
          <span className="text-muted text-[13px]">Admin</span>
          <div className="flex-1" />
          <span className="text-muted hidden text-[13px] sm:block">
            {session.name} · {session.affiliation}
          </span>
          <Link
            href="/"
            className="text-fg rounded-full border border-white/12 px-3.5 py-1.5 text-[13px] transition-colors hover:bg-white/5"
          >
            Back to Sol
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-6 py-8 lg:flex-row">
        <aside className="shrink-0 lg:w-[220px]">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
