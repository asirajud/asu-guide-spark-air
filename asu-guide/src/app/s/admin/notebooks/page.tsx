import { NotebooksPanel } from '@/components/admin/notebooks-panel'
import { isFeatureEnabled } from '@/lib/features'
import {
  NOTEBOOK_PAGE_CAP_MAX,
  NOTEBOOK_PAGE_CAP_MIN,
  getNotebookPageCap,
} from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

export default function AdminNotebooks() {
  return (
    <>
      <h1 className="text-[26px] font-medium tracking-[-0.03em] text-white">Notebooks</h1>
      <p className="text-muted mt-2 max-w-[62ch] text-[14.5px] leading-relaxed">
        Students drop in photos of notebook pages; an AIR vision model reads them one at a time and
        a running understanding is kept per notebook. Ships off. Changes apply on the next request.
      </p>

      <NotebooksPanel
        initial={{
          enabled: isFeatureEnabled('notebooks'),
          pageCap: getNotebookPageCap(),
          pageCapMin: NOTEBOOK_PAGE_CAP_MIN,
          pageCapMax: NOTEBOOK_PAGE_CAP_MAX,
        }}
      />
    </>
  )
}
