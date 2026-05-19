'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mic, History, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',        icon: Mic,     label: 'New'     },
  { href: '/history', icon: History, label: 'History' },
  { href: '/billing', icon: User,    label: 'Account' },
]

export default function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex w-[52px] flex-shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#111] py-4">
      {/* Logo */}
      <span className="mb-6 text-xs font-bold text-[#e2ff00]">T</span>

      {/* Nav items */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-1 py-2 w-10 transition-colors',
                isActive
                  ? 'bg-[#e2ff00]/10 text-[#e2ff00]'
                  : 'text-white/30 hover:text-white/60'
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
