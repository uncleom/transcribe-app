import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import HomeContent from '@/components/HomeContent'
import LogoutButton from '@/components/LogoutButton'
import InstallBanner from '@/components/InstallBanner'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        <span className="text-sm font-semibold text-white">Transcribo</span>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-xs text-white/35 truncate max-w-[120px] sm:max-w-[180px]">
                {user.email}
              </span>
              <Link
                href="/history"
                className="text-sm text-white/50 transition hover:text-white"
              >
                История
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-white/50 transition hover:text-white"
            >
              Войти
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Transcribo
            </h1>
            <p className="mt-2 text-white/45">
              Upload audio or video — get a transcript with speaker labels
            </p>
          </div>
          <HomeContent />
        </div>
      </main>

      <InstallBanner />
    </>
  )
}
