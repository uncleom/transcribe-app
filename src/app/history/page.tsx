import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import type { TranscriptionStatus } from '@/types'

function formatDuration(secs: number | null): string | null {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS: Record<TranscriptionStatus, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-white/10 text-white/40' },
  processing: { label: 'Processing', className: 'bg-yellow-400/15 text-yellow-400' },
  done:       { label: 'Done',       className: 'bg-green-400/15 text-green-400' },
  error:      { label: 'Error',      className: 'bg-red-400/15 text-red-400' },
}

export default async function HistoryPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: transcriptions } = await supabase
    .from('transcriptions')
    .select('id, file_name, language, duration_seconds, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        <Link href="/" className="text-sm font-semibold text-white hover:text-white/80 transition">
          Transcribe
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/40">History</span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-6 text-xl font-semibold text-white">History</h1>

          {!transcriptions?.length ? (
            <div className="rounded-xl border border-white/8 py-20 text-center">
              <p className="text-sm text-white/30">No transcriptions yet</p>
              <Link
                href="/"
                className="mt-3 inline-block text-sm text-white/50 underline hover:text-white/80 transition"
              >
                Upload your first file
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {transcriptions.map((t) => {
                const badge = STATUS[t.status as TranscriptionStatus] ?? STATUS.pending
                const duration = formatDuration(t.duration_seconds)

                return (
                  <li key={t.id}>
                    <Link
                      href={`/transcription/${t.id}`}
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
                          {t.file_name}
                        </p>
                        <p className="mt-0.5 text-xs text-white/30">
                          {formatDate(t.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2">
                        {t.language && (
                          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-white/50">
                            {t.language}
                          </span>
                        )}
                        {duration && (
                          <span className="text-xs text-white/35">{duration}</span>
                        )}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  )
}
