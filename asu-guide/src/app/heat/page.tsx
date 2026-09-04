import { Home } from '@/components/home'

export const dynamic = 'force-dynamic'

/** HeatRoute by URL. Falls back to `/` client-side when the admin switch is off. */
export default function HeatPage() {
  return <Home initialHeat />
}
