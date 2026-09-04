'use client'

/** A switch, drawn rather than a checkbox, so it reads the same in both states. */
export function Toggle({
  checked,
  onChange,
  label,
  busy,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  busy?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative h-[24px] w-[42px] shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        checked ? 'border-asu-gold/40 bg-asu-gold/25' : 'border-white/12 bg-white/6'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-[2px] size-[18px] rounded-full transition-all ${
          checked ? 'left-[21px] bg-asu-gold' : 'left-[2px] bg-[#8e9195]'
        }`}
      />
    </button>
  )
}
