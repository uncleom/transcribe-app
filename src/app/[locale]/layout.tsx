import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Toaster } from '@/components/ui/sonner'
import { routing } from '@/i18n/routing'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('title'),
    description: t('description'),
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: t('title'),
    },
    icons: {
      apple: '/icons/apple-touch-icon.png',
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full bg-[#0a0a0a] text-white">
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            <LanguageSwitcher />
            {children}
            <Toaster position="bottom-center" theme="dark" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
