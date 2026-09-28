import { setRequestLocale } from 'next-intl/server'
import AppShell from '@/components/AppShell'

export default async function ShellLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <AppShell>{children}</AppShell>
}
