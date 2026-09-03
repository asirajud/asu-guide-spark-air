'use client'

import { useState } from 'react'
import { EventCard } from '@/components/event-card'
import type { DemoEvent } from '@/lib/events'

const INITIAL = 2

/** The cards cited on one turn: two up front, the rest behind a toggle. */
export function EventList({ events }: { events: DemoEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  const hidden = events.length - INITIAL
  const shown = expanded ? events : events.slice(0, INITIAL)

  return (
    <>
      <h2 className="animate-rise mt-6 text-[17px] font-bold text-white">Coming up near you</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {shown.map((e, i) => (
          <EventCard key={e.id} event={e} index={i} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-asu-gold-soft mt-3 rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors hover:bg-white/5 active:scale-95"
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}
    </>
  )
}
