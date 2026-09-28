'use client'

import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from '@/i18n/navigation'

export default function LogoutButton() {
  const t = useTranslations('Billing')
  const router = useRouter()

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-white/40 transition hover:text-white/70"
    >
      {t('signOut')}
    </button>
  )
}
