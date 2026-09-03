'use client'

import { BriefIcon, Check } from '@/components/icons'
import type { DemoEvent } from '@/lib/events'

/**
 * What a brief would need before it could actually be written. Shown as the
 * honest precondition rather than as settings that do anything — none of these
 * connectors exist yet.
 */
const CONNECTORS = [
  {
    name: 'Google Calendar',
    detail: 'Your classes and anything already booked, so the brief works around them',
    connected: false,
  },
  {
    name: 'Canvas',
    detail: 'Due dates and new announcements from the courses you are enrolled in',
    connected: false,
  },
  { name: 'Sun Devil Central', detail: 'Campus events, clubs and RSVPs', connected: true },
]

/**
 * A static preview: one morning's brief, assembled from the live demo event
 * feed so the shape is real, with the parts that need a connector shown as
 * missing rather than faked.
 */
export function DailyBriefPreview({ events }: { events: DemoEvent[] }) {
  const today = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  return (
    <div className="thin-scroll relative z-10 flex w-full flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-5 pt-6 pb-8">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3a1723] text-[#ffc627]">
            <BriefIcon className="size-[22px]" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-medium tracking-[-0.02em] text-white">
              Daily brief
            </h1>
            <p className="text-muted text-[13px]">{today} · preview</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-7">
          <div className="flex justify-end">
            <p className="bg-surface-2 text-fg max-w-[85%] rounded-3xl px-5 py-3.5 text-[17px] leading-[1.4] tracking-[-0.01em]">
              What should I know about today?
            </p>
          </div>

          <div className="text-fg flex flex-col gap-4 text-[17px] leading-[1.55] tracking-[-0.01em]">
            <p>
              Every morning, one read of your day before you go looking for it — what is due, what
              moved, and what is worth walking across campus for.
            </p>

            {events.length > 0 && (
              <div className="mt-1 flex flex-col gap-3">
                <p className="text-muted text-[13px] tracking-[0.04em] uppercase">
                  On campus today
                </p>
                {events.slice(0, 3).map((e) => (
                  <div key={e.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                    <p className="text-[15.5px] font-medium text-white">{e.title}</p>
                    <p className="text-muted mt-1 text-[13.5px]">
                      {e.when} · {e.club}
                    </p>
                  </div>
                ))}
                <p className="text-muted text-[13px]">
                  Pulled live from Sun Devil Central — the one source already wired up.
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-muted mb-3 text-[13px] tracking-[0.04em] uppercase">
              Needs connecting
            </p>
            <div className="flex flex-col gap-2">
              {CONNECTORS.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-white">{c.name}</p>
                    <p className="text-muted mt-0.5 text-[13px] leading-snug">{c.detail}</p>
                  </div>
                  {c.connected ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-[#9ad4a4]">
                      <Check className="size-[15px]" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-muted shrink-0 rounded-full border border-white/12 px-3 py-1 text-[12.5px]">
                      Not yet
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-white/[0.02] px-5 py-4">
            <p className="text-muted text-[13.5px] leading-relaxed">
              Not built yet — this is a look at where Sol is going. The event feed above is real;
              the rest waits on connectors. See docs/ROADMAP.md.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
