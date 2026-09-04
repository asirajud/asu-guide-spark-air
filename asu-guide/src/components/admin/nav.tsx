'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BriefIcon, NotebookIcon } from '@/components/icons'

const SECTIONS = [
  {
    href: '/s/admin',
    label: 'Settings',
    hint: 'Models per capability',
    Icon: BriefIcon,
  },
  {
    href: '/s/admin/services',
    label: 'Services',
    hint: 'Tools the model can reach',
    Icon: BriefIcon,
  },
  {
    href: '/s/admin/notebooks',
    label: 'Notebooks',
    hint: 'Switch and page cap',
    Icon: NotebookIcon,
  },
]

export function AdminNav() {
  const path = usePathname()

  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-1">
      {SECTIONS.map(({ href, label, hint, Icon }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 transition-colors ${
              active ? 'bg-[#3a1723]' : 'hover:bg-white/5'
            }`}
          >
            <Icon
              className={`mt-[2px] size-[17px] shrink-0 ${active ? 'text-[#ffc627]' : 'text-muted'}`}
            />
            <span className="min-w-0">
              <span
                className={`block text-[14.5px] ${active ? 'font-medium text-white' : 'text-fg'}`}
              >
                {label}
              </span>
              <span className="text-muted block text-[12px] leading-snug">{hint}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
