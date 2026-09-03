import { CAPABILITIES } from '@/lib/air/capabilities'
import { MODELS } from '@/lib/air/models'
import { readOverrides } from '@/lib/air/settings'
import { SettingsPanel } from '@/components/admin/settings-panel'
import { FeaturesPanel } from '@/components/admin/features-panel'
import { readFeatures } from '@/lib/features'

export const dynamic = 'force-dynamic'

/**
 * The configuration surface. Rendered server-side with the current choices
 * already in place, so the dropdowns never flash a default before settling on
 * what is actually configured.
 */
export default async function AdminSettings() {
  const overrides = readOverrides()
  const initial = CAPABILITIES.flatMap((c) =>
    c.slots.map((s) => ({
      service: s.service,
      chosen: overrides.get(s.service)?.model ?? null,
      recommended: MODELS[s.service] ?? [],
      updatedBy: overrides.get(s.service)?.updatedBy ?? null,
    })),
  )

  return (
    <>
      <h1 className="text-[26px] font-medium tracking-[-0.03em] text-white">Settings</h1>
      <p className="text-muted mt-2 max-w-[62ch] text-[14.5px] leading-relaxed">
        Which AIR model serves each capability. Choices take effect on the next request — there is
        nothing to restart.
      </p>

      <SettingsPanel capabilities={CAPABILITIES} initial={initial} />

      <FeaturesPanel initial={readFeatures()} />
    </>
  )
}
