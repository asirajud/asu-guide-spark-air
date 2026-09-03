import * as React from 'react'

type P = React.SVGProps<SVGSVGElement>

/** The 4-point sparkle mark, ASU maroon -> gold gradient. */
export function Sparkle({ gradientId = 'sparkle-grad', ...p }: P & { gradientId?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="18"
          x2="20"
          y2="7"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5C1229" />
          <stop offset="0.35" stopColor="#8C1D40" />
          <stop offset="0.72" stopColor="#D98A2B" />
          <stop offset="1" stopColor="#FFC627" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.4c.62 5.32 5.28 9.98 10.6 10.6-5.32.62-9.98 5.28-10.6 10.6-.62-5.32-5.28-9.98-10.6-10.6C6.72 11.38 11.38 6.72 12 1.4Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  )
}

export function Hamburger(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <path d="M4 9h16M4 15h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** Compose / new-chat pencil with the dotted sparkle ring, as in the header. */
export function ComposePencil(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <path
        d="M16.6 4.7a1.7 1.7 0 0 1 2.4 2.4L9.6 16.5l-3.2.8.8-3.2 9.4-9.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <g fill="currentColor">
        <circle cx="5.1" cy="8.2" r="0.85" />
        <circle cx="7.4" cy="5.9" r="0.7" />
        <circle cx="10.4" cy="4.9" r="0.6" />
        <circle cx="4.2" cy="11.2" r="0.7" />
        <circle cx="4.7" cy="14.4" r="0.6" />
      </g>
    </svg>
  )
}

export function Plus(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function Mic(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <rect
        x="9.1"
        y="2.6"
        width="5.8"
        height="11"
        rx="2.9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.9V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** The audio-waveform glyph inside the blue circular button. */
export function Waveform(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M6 10.5v3" />
        <path d="M10 5.5v13" />
        <path d="M14 5.5v13" />
        <path d="M18 10.5v3" />
      </g>
    </svg>
  )
}

export function Chevron(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Check(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <path
        d="M5 12.8l4.4 4.4L19 7.6"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Paperclip(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path
        d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.6-2.6l7.4-7.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PhotoStack(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="3" y="5" width="15" height="12" rx="2.5" />
      <path d="M6.5 17 11 12l3 3 2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="9" r="1.2" />
      <path d="M7 20h11a3 3 0 0 0 3-3V9" strokeLinecap="round" />
    </svg>
  )
}

export function CameraIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.7A1 1 0 0 1 9.1 4h5.8a1 1 0 0 1 .8.4L16.8 6h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  )
}

export function Close(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}>
      <circle cx="11" cy="11" r="6.6" />
      <path d="m16 16 4.5 4.5" strokeLinecap="round" />
    </svg>
  )
}

export function Dots(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="5.5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="18.5" r="1.7" />
    </svg>
  )
}

export function PinIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M9 3h6l-1 6 3.2 2.6V14H6.8v-2.4L10 9z" strokeLinejoin="round" />
      <path d="M12 14v7" strokeLinecap="round" />
    </svg>
  )
}

export function TrashIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" strokeLinecap="round" />
      <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" strokeLinejoin="round" />
    </svg>
  )
}

export function RenameIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M4 20h4l10-10a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6z" strokeLinejoin="round" />
    </svg>
  )
}

/** Upward arrow used by the composer's send control. */
export function SendArrow(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <path
        d="M12 19V5M12 5l-6 6M12 5l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
