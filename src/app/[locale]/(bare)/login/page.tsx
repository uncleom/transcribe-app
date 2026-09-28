import { getTranslations, setRequestLocale } from 'next-intl/server'
import SignInButton from '@/components/SignInButton'

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Login')

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">{t('title')}</h1>
          <p className="mt-2 text-sm text-white/40">{t('subtitle')}</p>
        </div>
        <SignInButton />
      </div>
    </main>
  )
}
