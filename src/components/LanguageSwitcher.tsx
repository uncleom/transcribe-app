'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export default function LanguageSwitcher() {
  const t = useTranslations('LanguageSwitcher')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="fixed top-3 right-3 z-50 flex gap-0.5 rounded-lg border border-white/10 bg-[#111]/90 p-0.5 backdrop-blur-sm"
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide transition',
            locale === l
              ? 'bg-[#e2ff00]/15 text-[#e2ff00]'
              : 'text-white/35 hover:text-white/70'
          )}
        >
          {t(l as Locale)}
        </button>
      ))}
    </div>
  )
}
