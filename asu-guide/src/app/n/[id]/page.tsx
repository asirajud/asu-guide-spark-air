import { Home } from '@/components/home'

export const dynamic = 'force-dynamic'

/** A notebook by id. Ownership and the feature switch are enforced by the API the view calls. */
export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Home initialNotebook={id} />
}
