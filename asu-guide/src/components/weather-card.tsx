'use client'

import type { WeatherReport } from '@/lib/tools'

const LEVEL = {
  ok: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.07]',
  caution: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/[0.07]',
  extreme: 'text-orange-300 border-orange-400/30 bg-orange-400/[0.08]',
  danger: 'text-red-300 border-red-400/30 bg-red-400/[0.08]',
} as Record<string, string>

function Glyph({ icon, className = 'size-5' }: { icon: string; className?: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }
  switch (icon) {
    case 'sun':
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'cloud-sun':
      return (
        <svg {...common} className={className}>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1" strokeLinecap="round" />
          <path d="M9 20h8.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.4 14.5 2.8 2.8 0 0 0 9 20Z" />
        </svg>
      )
    case 'rain':
      return (
        <svg {...common} className={className}>
          <path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.5 2.8 2.8 0 0 0 7 15Z" />
          <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" strokeLinecap="round" />
        </svg>
      )
    case 'storm':
      return (
        <svg {...common} className={className}>
          <path d="M7 14h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.5 2.8 2.8 0 0 0 7 14Z" />
          <path d="M13 14l-2 4h3l-2 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'fog':
      return (
        <svg {...common} className={className}>
          <path d="M4 10h16M6 14h12M8 18h8" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg {...common} className={className}>
          <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 12.5 2.8 2.8 0 0 0 7 18Z" />
        </svg>
      )
  }
}

const hourLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '')
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** Tempe weather, inline in the chat: now, one line of heat guidance, and an hourly strip. */
export function WeatherCard({ report }: { report: WeatherReport }) {
  const { current, hourly, today, advice } = report
  const tone = LEVEL[advice.level] ?? LEVEL.ok
  const coolest = hourly.reduce<(typeof hourly)[number] | null>(
    (best, h) => (!best || h.feelsLikeF < best.feelsLikeF ? h : best),
    null,
  )

  return (
    <div className="animate-rise mt-4 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02]">
      <div className="flex items-center gap-4 px-5 pt-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#3a1723] text-[#ffc627]">
          <Glyph icon={current.icon} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-fg flex items-baseline gap-2 text-[26px] leading-none tracking-[-0.02em] tabular-nums">
            {current.tempF}°
            <span className="text-muted text-[15px] tracking-normal">
              feels {current.feelsLikeF}° · {current.condition}
            </span>
          </p>
          <p className="text-muted mt-1.5 text-[13.5px]">
            {report.place} · H {today.highF}° L {today.lowF}° · UV {current.uv} · wind{' '}
            {current.windMph} mph · {current.humidity}% humidity
          </p>
        </div>
      </div>

      {advice.text && (
        <p
          className={`mx-5 mt-4 rounded-2xl border px-4 py-2.5 text-[14.5px] leading-snug ${tone}`}
        >
          {advice.text}
          {coolest && coolest.feelsLikeF < current.feelsLikeF - 4 && (
            <span className="text-fg/80">
              {' '}
              Coolest soon: {hourLabel(coolest.time)}, feels {coolest.feelsLikeF}°.
            </span>
          )}
        </p>
      )}

      <ul className="no-scroll mt-4 flex gap-1 overflow-x-auto px-3 pb-4">
        {hourly.map((h, i) => {
          const hot = h.feelsLikeF >= 105
          return (
            <li
              key={h.time}
              className={`flex w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-2xl py-3 ${
                i === 0 ? 'bg-white/[0.05]' : ''
              }`}
              title={`${clock(h.time)} · ${h.condition} · feels ${h.feelsLikeF}° · UV ${h.uv} · ${h.windMph} mph`}
            >
              <span className="text-muted text-[12.5px]">
                {i === 0 ? 'Now' : hourLabel(h.time)}
              </span>
              <Glyph icon={h.icon} className={`size-5 ${hot ? 'text-orange-300' : 'text-fg/80'}`} />
              <span className="text-fg text-[16px] tabular-nums">{h.tempF}°</span>
              <span
                className={`text-[11.5px] tabular-nums ${hot ? 'text-orange-300' : 'text-muted'}`}
              >
                {h.feelsLikeF}°
              </span>
              {h.precipPct >= 20 && (
                <span className="text-[11px] text-sky-300 tabular-nums">{h.precipPct}%</span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="text-muted px-5 pb-4 text-[12.5px]">
        Sunrise {clock(today.sunrise)} · Sunset {clock(today.sunset)} · UV max {today.uvMax} ·
        Open-Meteo
      </p>
    </div>
  )
}
