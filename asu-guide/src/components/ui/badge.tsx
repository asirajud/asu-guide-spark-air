import * as React from 'react'
import { cn } from '@/lib/utils'

/** Small rounded source/type chip — #303134 bg, #c4c7c5 text. */
export function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'bg-chip text-chip-fg inline-flex items-center rounded-md px-2 py-[3px] text-[11px] leading-none font-normal tracking-normal',
        className,
      )}
      {...props}
    />
  )
}
