'use client'

import { useTranslations } from 'next-intl'
import { Mic, History, User } from 'lucide-react'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export default function DesktopNav() {
  const t = useTranslations('Nav')
  const pathname = usePathname()

  const NAV_ITEMS = [
    { href: '/' as const, icon: Mic, label: t('new') },
    { href: '/history' as const, icon: History, label: t('history') },
    { href: '/billing' as const, icon: User, label: t('account') },
  ]

  return (
    <nav className="hidden md:flex w-[52px] flex-shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#111] py-4">
      <span className="mb-6 text-xs font-bold text-[#e2ff00]">T</span>

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
                  ? 'bg-[#e2ff00]/15 text-[#e2ff00] ring-1 ring-[#e2ff00]/20'
                  : 'text-white/30 hover:text-white/50'
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
