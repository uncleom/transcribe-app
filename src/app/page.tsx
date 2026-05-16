import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import HomeContent from '@/components/HomeContent'
import LogoutButton from '@/components/LogoutButton'
import InstallBanner from '@/components/InstallBanner'

function formatCredits(secs: number): string {
  if (secs <= 0) return '0m'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let creditsSeconds: number | null = null
  let isUnlimited = false
  let hasTelegram = false
  if (user) {
    const [{ data: profile }, { data: tg }] = await Promise.all([
      supabase.from('profiles').select('credits_seconds, is_unlimited').eq('id', user.id).single(),
      supabase.from('telegram_accounts').select('telegram_id').eq('supabase_user_id', user.id).maybeSingle(),
    ])
    creditsSeconds = profile?.credits_seconds ?? 0
    isUnlimited = profile?.is_unlimited ?? false
    hasTelegram = !!tg
  }

  const isLow = !isUnlimited && creditsSeconds != null && creditsSeconds < 60

  return (
    <>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        <span className="text-sm font-semibold text-white">Transcribo</span>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/billing"
                className={`text-xs font-medium transition hover:opacity-80 ${isLow ? 'text-yellow-400' : 'text-white/35'}`}
              >
                {isUnlimited ? '∞' : `${formatCredits(creditsSeconds ?? 0)} left`}
              </Link>
              <Link href="/history" className="text-sm text-white/50 transition hover:text-white">
                History
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="text-sm text-white/50 transition hover:text-white">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">Transcribo</h1>
            <p className="mt-2 text-white/45">
              Upload audio or video — get a transcript with speaker labels
            </p>
          </div>
          <HomeContent />
          {!user && (
            <p className="mt-5 text-center text-xs text-white/30">
              3 minutes free · {' '}
              <Link href="/login" className="text-white/50 underline hover:text-white/70 transition">
                Sign in
              </Link>
              {' '} for 20 minutes free
            </p>
          )}

          {/* Telegram promo — hidden if already connected */}
          {!hasTelegram && (
            <div className="mt-8 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
              <div className="flex items-center gap-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="12" fill="#2AABEE"/>
                  <path d="M17.6 7.2L15.5 17.6c-.2.7-.6.9-1.2.6l-3.3-2.4-1.6 1.5c-.2.2-.3.3-.7.3l.2-3.3 6.1-5.5c.3-.2-.1-.4-.4-.1L7 13.5l-3.2-1c-.7-.2-.7-.7.2-1l13-5c.5-.2 1 .1.8.7z" fill="white"/>
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/70">Also on Telegram</p>
                  <p className="text-xs text-white/35">
                    Forward voice messages or audio — get transcript in the chat
                  </p>
                </div>
                <Link
                  href="/connect-telegram"
                  className="flex-shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/25 hover:text-white/80"
                >
                  {user ? 'Connect' : 'Learn more'}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <InstallBanner />
    </>
  )
}
