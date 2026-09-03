import { ServicesPanel } from '@/components/admin/services-panel'

export const dynamic = 'force-dynamic'

export default function AdminServices() {
  return (
    <>
      <h1 className="text-[26px] font-medium tracking-[-0.03em] text-white">Services</h1>
      <p className="text-muted mt-2 max-w-[62ch] text-[14.5px] leading-relaxed">
        Every tool Sol can reach for, grouped by the service that owns it. The registry decides what
        exists; this decides what the model is allowed to call.
      </p>

      <ServicesPanel />
    </>
  )
}
