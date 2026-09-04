'use client'

import type { WeatherHour, WeatherReport } from '@/lib/tools'

/**
 * Tempe weather, inline in the chat. The card takes its colour and its animated
 * hero from the current condition and the heat: a hot afternoon glows orange to
 * maroon, a clear night goes deep blue, rain streaks, a storm flashes, high wind
 * drifts dust. Hourly cells show one temperature; feels-like appears only when
 * it is meaningfully hotter than the air.
 */

type Scene = 'hot' | 'warm' | 'cool' | 'night' | 'cloud' | 'rain' | 'storm' | 'dust' | 'fog'

function sceneFor(r: WeatherReport): Scene {
  const c = r.current
  if (c.icon === 'storm') return 'storm'
  if (c.icon === 'rain') return 'rain'
  if (c.icon === 'fog') return 'fog'
  if (c.windMph >= 25 && c.icon !== 'cloud') return 'dust'
  if (!c.isDay) return 'night'
  if (c.icon === 'cloud') return 'cloud'
  if (c.feelsLikeF >= 100) return 'hot'
  if (c.feelsLikeF >= 85) return 'warm'
  return 'cool'
}

const SCENE: Record<Scene, { bg: string; accent: string; label: string }> = {
  hot: { bg: 'from-[#ff7a18] via-[#c2410c] to-[#8c1d40]', accent: '#ffc627', label: 'Hot' },
  warm: { bg: 'from-[#f59e0b] via-[#b45309] to-[#3a1723]', accent: '#ffd166', label: 'Warm' },
  cool: { bg: 'from-[#38bdf8] via-[#0ea5e9] to-[#0f3d5c]', accent: '#e0f2fe', label: 'Cool' },
  night: { bg: 'from-[#1e1b4b] via-[#0f172a] to-[#020617]', accent: '#fde68a', label: 'Night' },
  cloud: { bg: 'from-[#64748b] via-[#334155] to-[#0f172a]', accent: '#e2e8f0', label: 'Cloudy' },
  rain: { bg: 'from-[#3b82f6] via-[#1e3a8a] to-[#0f172a]', accent: '#bfdbfe', label: 'Rain' },
  storm: { bg: 'from-[#6d28d9] via-[#312e81] to-[#0f172a]', accent: '#fde047', label: 'Storm' },
  dust: {
    bg: 'from-[#d9a066] via-[#92400e] to-[#3f1d0b]',
    accent: '#fed7aa',
    label: 'Dust / wind',
  },
  fog: { bg: 'from-[#94a3b8] via-[#475569] to-[#1e293b]', accent: '#f1f5f9', label: 'Fog' },
}

/** Animated hero for the current condition. Pure SVG + CSS keyframes, no library. */
function Hero({ scene }: { scene: Scene }) {
  const common = { viewBox: '0 0 120 120', className: 'wx-hero size-[88px]', 'aria-hidden': true }
  switch (scene) {
    case 'hot':
    case 'warm':
      return (
        <svg {...common}>
          <g className="wx-spin" style={{ transformOrigin: '60px 60px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <line
                key={i}
                x1="60"
                y1="10"
                x2="60"
                y2="24"
                stroke="#ffe08a"
                strokeWidth="5"
                strokeLinecap="round"
                transform={`rotate(${i * 30} 60 60)`}
                opacity={0.9}
              />
            ))}
          </g>
          <circle cx="60" cy="60" r="26" fill="#ffc627" className="wx-pulse" />
          {scene === 'hot' &&
            [0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M${42 + i * 18} 100 q4 -6 0 -12 q-4 -6 0 -12`}
                fill="none"
                stroke="#fff3c4"
                strokeWidth="3"
                strokeLinecap="round"
                className="wx-heat"
                style={{ animationDelay: `${i * 0.35}s` }}
              />
            ))}
        </svg>
      )
    case 'night':
      return (
        <svg {...common}>
          <path
            d="M74 22a34 34 0 1 0 24 58 28 28 0 1 1-24-58Z"
            fill="#fde68a"
            className="wx-pulse"
          />
          {[
            [22, 30],
            [34, 70],
            [96, 92],
            [18, 96],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2.4"
              fill="#fff"
              className="wx-twinkle"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </svg>
      )
    case 'cool':
      return (
        <svg {...common}>
          <circle cx="60" cy="56" r="22" fill="#e0f2fe" className="wx-pulse" />
          <path
            d="M18 92 q14 -10 28 0 t28 0 t28 0"
            fill="none"
            stroke="#bae6fd"
            strokeWidth="4"
            strokeLinecap="round"
            className="wx-drift"
          />
        </svg>
      )
    case 'cloud':
    case 'fog':
      return (
        <svg {...common}>
          <path
            d="M36 84h48a16 16 0 0 0 2.5-31.8A24 24 0 0 0 40.8 60 12 12 0 0 0 36 84Z"
            fill="#e2e8f0"
            className="wx-drift"
          />
          <path
            d="M20 100h60"
            stroke="#cbd5e1"
            strokeWidth="4"
            strokeLinecap="round"
            className="wx-drift"
            style={{ animationDelay: '0.8s' }}
          />
        </svg>
      )
    case 'rain':
      return (
        <svg {...common}>
          <path
            d="M36 68h48a16 16 0 0 0 2.5-31.8A24 24 0 0 0 40.8 44 12 12 0 0 0 36 68Z"
            fill="#dbeafe"
            className="wx-drift"
          />
          {[44, 58, 72, 86].map((x, i) => (
            <line
              key={x}
              x1={x}
              y1="76"
              x2={x - 4}
              y2="90"
              stroke="#93c5fd"
              strokeWidth="4"
              strokeLinecap="round"
              className="wx-rain"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </svg>
      )
    case 'storm':
      return (
        <svg {...common}>
          <path
            d="M36 62h48a16 16 0 0 0 2.5-31.8A24 24 0 0 0 40.8 38 12 12 0 0 0 36 62Z"
            fill="#c7d2fe"
            className="wx-drift"
          />
          <path
            d="M64 62l-10 20h12l-8 22"
            fill="none"
            stroke="#fde047"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="wx-flash"
          />
        </svg>
      )
    case 'dust':
      return (
        <svg {...common}>
          <circle cx="60" cy="48" r="20" fill="#fed7aa" opacity="0.8" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle
              key={i}
              cx={20 + i * 16}
              cy={80 + (i % 2) * 10}
              r={2 + (i % 3)}
              fill="#fdba74"
              className="wx-dust"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </svg>
      )
  }
}

function Glyph({
  icon,
  night,
  className = 'size-5',
}: {
  icon: string
  night: boolean
  className?: string
}) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }
  if (night && (icon === 'sun' || icon === 'cloud-sun')) {
    return (
      <svg {...common} className={className}>
        <path d="M15 3a8 8 0 1 0 6 13.5A7 7 0 1 1 15 3Z" />
      </svg>
    )
  }
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

/** Is this hour outside daylight? Compares wall-clock hours from the report's own sunrise/sunset. */
function isNightHour(h: WeatherHour, today: WeatherReport['today']) {
  const hh = new Date(h.time).getHours() + new Date(h.time).getMinutes() / 60
  const rise = new Date(today.sunrise)
  const set = new Date(today.sunset)
  const r = rise.getHours() + rise.getMinutes() / 60
  const s = set.getHours() + set.getMinutes() / 60
  return hh < r || hh >= s
}

export function WeatherCard({ report }: { report: WeatherReport }) {
  const { current, hourly, today, advice } = report
  const scene = sceneFor(report)
  const theme = SCENE[scene]
  const coolest = hourly.reduce<WeatherHour | null>(
    (best, h) => (!best || h.feelsLikeF < best.feelsLikeF ? h : best),
    null,
  )
  const showCooler = coolest && coolest.feelsLikeF <= current.feelsLikeF - 4
  const maxT = Math.max(...hourly.map((h) => h.tempF))
  const minT = Math.min(...hourly.map((h) => h.tempF))

  return (
    <div className="animate-rise mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e0f]">
      <style>{`
        .wx-hero{overflow:visible}
        @keyframes wx-spin{to{transform:rotate(360deg)}}
        @keyframes wx-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes wx-heat{0%{opacity:0;transform:translateY(6px)}40%{opacity:.9}100%{opacity:0;transform:translateY(-14px)}}
        @keyframes wx-twinkle{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes wx-drift{0%,100%{transform:translateX(-4px)}50%{transform:translateX(4px)}}
        @keyframes wx-rain{0%{opacity:0;transform:translateY(-8px)}30%{opacity:1}100%{opacity:0;transform:translateY(14px)}}
        @keyframes wx-flash{0%,84%,100%{opacity:.35}88%,94%{opacity:1}}
        @keyframes wx-dust{0%{opacity:0;transform:translateX(-14px)}40%{opacity:.9}100%{opacity:0;transform:translateX(18px)}}
        .wx-spin{animation:wx-spin 28s linear infinite}
        .wx-pulse{animation:wx-pulse 3.2s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
        .wx-heat{animation:wx-heat 2.2s ease-out infinite}
        .wx-twinkle{animation:wx-twinkle 2.4s ease-in-out infinite}
        .wx-drift{animation:wx-drift 6s ease-in-out infinite}
        .wx-rain{animation:wx-rain 1.1s linear infinite}
        .wx-flash{animation:wx-flash 3.5s ease-in-out infinite}
        .wx-dust{animation:wx-dust 2.8s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.wx-spin,.wx-pulse,.wx-heat,.wx-twinkle,.wx-drift,.wx-rain,.wx-flash,.wx-dust{animation:none}}
      `}</style>

      {/* Hero: colour and motion from the current condition */}
      <div className={`relative bg-gradient-to-br ${theme.bg} px-5 pt-5 pb-6 text-white`}>
        <div className="flex items-center gap-4">
          <Hero scene={scene} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-[0.06em] uppercase opacity-80">
              {report.place} · {theme.label}
            </p>
            <p className="mt-1 flex items-baseline gap-3">
              <span className="text-[44px] leading-none font-medium tracking-[-0.03em] tabular-nums">
                {current.tempF}°
              </span>
              <span className="text-[16px] opacity-90">{current.condition}</span>
            </p>
            <p className="mt-2 text-[14px] opacity-90">
              {current.feelsLikeF !== current.tempF && `Feels ${current.feelsLikeF}° · `}H{' '}
              {today.highF}° L {today.lowF}° · UV {current.uv} · {current.windMph} mph ·{' '}
              {current.humidity}% humidity
            </p>
          </div>
        </div>
        {advice.text && (
          <p className="mt-4 rounded-2xl bg-black/25 px-4 py-2.5 text-[14.5px] leading-snug backdrop-blur-sm">
            {advice.text}
            {showCooler && coolest && (
              <span className="opacity-90">
                {' '}
                Coolest ahead: {hourLabel(coolest.time)}, feels {coolest.feelsLikeF}°.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Hourly: one temperature per hour, a bar for the trend, feels-like only when it bites */}
      <ul className="no-scroll flex gap-1 overflow-x-auto px-3 pt-3 pb-3">
        {hourly.map((h, i) => {
          const night = isNightHour(h, today)
          const hot = h.feelsLikeF >= 100
          const pct = maxT === minT ? 60 : 30 + ((h.tempF - minT) / (maxT - minT)) * 70
          return (
            <li
              key={h.time}
              className={`flex w-[64px] shrink-0 flex-col items-center gap-1.5 rounded-2xl py-2.5 ${
                i === 0 ? 'bg-white/[0.06]' : ''
              }`}
              title={`${clock(h.time)} · ${h.condition} · feels ${h.feelsLikeF}° · UV ${h.uv} · ${h.windMph} mph${h.precipPct ? ` · ${h.precipPct}% rain` : ''}`}
            >
              <span className="text-muted text-[12.5px]">
                {i === 0 ? 'Now' : hourLabel(h.time)}
              </span>
              <Glyph
                icon={h.icon}
                night={night}
                className={`size-5 ${hot ? 'text-orange-300' : night ? 'text-[#fde68a]' : 'text-fg/85'}`}
              />
              <span className="text-fg text-[16px] tabular-nums">{h.tempF}°</span>
              <span
                aria-hidden
                className="w-1.5 rounded-full"
                style={{
                  height: `${Math.round((pct / 100) * 28)}px`,
                  background: hot
                    ? '#fb923c'
                    : `linear-gradient(to top, ${theme.accent}55, ${theme.accent})`,
                }}
              />
              <span className="h-[15px] text-[11px] tabular-nums text-orange-300">
                {h.feelsLikeF - h.tempF >= 3 ? `feels ${h.feelsLikeF}°` : ''}
              </span>
              {h.precipPct >= 20 && (
                <span className="text-[11px] text-sky-300 tabular-nums">{h.precipPct}%</span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="text-muted border-t border-white/6 px-5 py-3 text-[12.5px]">
        Sunrise {clock(today.sunrise)} · Sunset {clock(today.sunset)} · UV max {today.uvMax} ·
        Open-Meteo
      </p>
    </div>
  )
}
