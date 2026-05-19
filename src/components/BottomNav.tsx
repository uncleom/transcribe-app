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

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-white/[0.06] bg-[#0a0a0a]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors',
              isActive ? 'text-[#e2ff00]' : 'text-white/25 hover:text-white/50'
            )}
          >
            <div className={cn(
              'flex items-center justify-center w-11 h-7 rounded-full transition-colors',
              isActive ? 'bg-[#e2ff00]/12' : ''
            )}>
              <Icon size={20} strokeWidth={isActive ? 2 : 1.75} />
            </div>
            <span className="text-[9px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
