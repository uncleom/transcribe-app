import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import SignInButton from '@/components/SignInButton'
import { Link } from '@/i18n/navigation'
import type { TranscriptionStatus } from '@/types'

function formatDuration(secs: number | null): string | null {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string, locale: string): string {
  const localeTag = locale === 'es' ? 'es-419' : locale === 'pt' ? 'pt-BR' : 'en-US'
  return new Date(iso).toLocaleDateString(localeTag, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('History')
  const activeLocale = await getLocale()

  const STATUS: Record<TranscriptionStatus, { label: string; cls: string }> = {
    pending:    { label: t('statusPending'),    cls: 'bg-white/10 text-white/40 border-transparent hover:bg-white/10' },
    processing: { label: t('statusProcessing'), cls: 'bg-yellow-400/15 text-yellow-400 border-transparent hover:bg-yellow-400/15' },
    done:       { label: t('statusDone'),       cls: 'bg-green-400/15 text-green-400 border-transparent hover:bg-green-400/15' },
    error:      { label: t('statusError'),      cls: 'bg-red-400/15 text-red-400 border-transparent hover:bg-red-400/15' },
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
            <p className="mt-2 text-sm text-white/40">{t('signInPrompt')}</p>
          </div>
          <SignInButton />
        </div>
      </main>
    )
  }

  const { data: transcriptions } = await supabase
    .from('transcriptions')
    .select('id, file_name, language, duration_seconds, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-xl font-semibold text-white">{t('title')}</h1>

        {!transcriptions?.length ? (
          <div className="rounded-xl border border-white/8 py-20 text-center">
            <p className="text-sm text-white/30">{t('empty')}</p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm text-white/50 underline hover:text-white/80 transition"
            >
              {t('uploadFirst')}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {transcriptions.map((row) => {
              const badge = STATUS[row.status as TranscriptionStatus] ?? STATUS.pending
              const duration = formatDuration(row.duration_seconds)

              return (
                <li key={row.id}>
                  <Link
                    href={`/transcription/${row.id}`}
                    className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-4 transition hover:bg-white/[0.03]"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06] transition group-hover:bg-white/[0.09]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/85 transition group-hover:text-white">
                        {row.file_name}
                      </p>
                      <p className="mt-0.5 text-xs text-white/30">
                        {formatDate(row.created_at, activeLocale)}
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      {row.language && (
                        <Badge className="bg-white/8 text-white/50 border-transparent uppercase tracking-wide hover:bg-white/8">
                          {row.language.split(/[+\-]/)[0]}
                        </Badge>
                      )}
                      {duration && (
                        <span className="text-xs text-white/35">{duration}</span>
                      )}
                      <Badge className={badge.cls}>
                        {badge.label}
                      </Badge>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
