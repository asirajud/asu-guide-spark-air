import { ExternalLink } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DemoEvent } from '@/lib/events'

export function EventCard({ event, index }: { event: DemoEvent; index: number }) {
  return (
    <li className="animate-rise list-none" style={{ animationDelay: `${120 + index * 90}ms` }}>
      <div className="flex gap-3">
        {/* Hollow bullet, as in the Gemini answer list */}
        <span
          aria-hidden
          className="mt-[9px] size-[7px] shrink-0 rounded-full border border-[#8e9195]"
        />

        <div className="min-w-0 flex-1 rounded-[18px] bg-[#131314] px-3.5 py-3">
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

          {/*
            One control, and it leaves. Registering really happens on Sun Devil
            Central, so a button that flipped to "Registered" in local state was
            claiming a seat nobody held — and it sat next to a second link to
            the same page. The card sends the student to the real thing instead.
          */}
          {event.url && (
            <div className="mt-3">
              <Button asChild size="sm" variant="pill">
                <a href={event.url} target="_blank" rel="noopener noreferrer">
                  Register on Sun Devil Central
                  <ExternalLink className="size-[13px]" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
