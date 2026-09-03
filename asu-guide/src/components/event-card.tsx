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
            registered ? 'border-[#a8c7fa] bg-[#a8c7fa]' : 'border-[#8e9195]',
          )}
        />

        <div
          className={cn(
            'min-w-0 flex-1 rounded-[18px] px-3.5 py-3 transition-colors duration-300',
            registered ? 'bg-[#12233f]' : 'bg-[#131314]',
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

          <div className="mt-3 flex items-center">
            {registered ? (
              <span className="animate-pop inline-flex items-center gap-1.5 text-[13px] font-medium text-[#a8c7fa]">
                <span className="flex size-[18px] items-center justify-center rounded-full bg-[#a8c7fa] text-[#0b1a30]">
                  <Check className="size-3" />
                </span>
                Registered
              </span>
            ) : (
              <Button size="sm" variant="pill" onClick={() => setRegistered(true)}>
                Register
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
