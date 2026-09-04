import { Home } from '@/components/home'

export const dynamic = 'force-dynamic'

/** A saved chat by id. Unknown or foreign ids fall back to an empty chat client-side. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Home initialChat={id} />
}
