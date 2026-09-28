import { setRequestLocale } from 'next-intl/server'

export default async function BareLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <div className="flex flex-col h-full">{children}</div>
}
