'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { DemoEvent } from '@/lib/events'

export function EventCard({ event, index }: { event: DemoEvent; index: number }) {
  const [registered, setRegistered] = useState(false)

  return (
    <li className="animate-rise list-none" style={{ animationDelay: `${120 + index * 90}ms` }}>
      <div className="flex gap-3">
        {/* Hollow bullet, as in the Gemini answer list */}
        <span
          aria-hidden
          className={cn(
            'mt-[9px] size-[7px] shrink-0 rounded-full border transition-colors',
            registered ? 'border-asu-gold bg-asu-gold' : 'border-[#8e9195]',
          )}
        />

        <div
          className={cn(
            'min-w-0 flex-1 rounded-[18px] px-3.5 py-3 transition-colors duration-300',
            registered ? 'bg-asu-maroon-tint' : 'bg-[#131314]',
          )}
        >
          <p className="text-[15.5px] leading-[1.42] font-semibold text-white">{event.title}</p>

          <p className="text-muted mt-1 text-[13.5px] leading-[1.4]">
            {event.when}
            <span className="px-1.5 text-[#5f6368]">·</span>
            <span className="text-[#c4c7c5]">{event.club}</span>
          </p>

          <div className="mt-2 flex items-center gap-2">
            <Badge>{event.type}</Badge>
          </div>

          <p className="text-muted mt-2 text-[13.5px] leading-[1.5]">{event.blurb}</p>

          <div className="mt-3 flex items-center gap-3">
            {registered ? (
              <span className="text-asu-gold animate-pop inline-flex items-center gap-1.5 text-[13px] font-medium">
                <span className="bg-asu-gold text-asu-accent-fg flex size-[18px] items-center justify-center rounded-full">
                  <Check className="size-3" />
                </span>
                Registered
              </span>
            ) : (
              <Button size="sm" variant="pill" onClick={() => setRegistered(true)}>
                Register
              </Button>
            )}
            {/* Register is a local demo flip and this link is the only route to the real RSVP page */}
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-white text-[13px] underline decoration-dotted underline-offset-4 transition-colors"
              >
                View event
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}
