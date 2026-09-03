import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-blue/60",
  {
    variants: {
      variant: {
        default: 'bg-blue-solid text-white hover:bg-[#1b6ef3] active:scale-[0.97]',
        pill: 'bg-[#2d2f31] text-fg hover:bg-[#3a3c3f] active:scale-[0.97]',
        outline: 'border border-[#3c4043] text-fg hover:bg-[#1f1f1f]',
        ghost: 'text-fg hover:bg-[#1f1f1f]',
        confirmed: 'bg-transparent text-[#a8c7fa] cursor-default',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3.5 text-[13px]',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
