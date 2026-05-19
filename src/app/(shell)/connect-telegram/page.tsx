import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import TelegramLinkButton from '@/components/TelegramLinkButton'

export default async function ConnectTelegramPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isLinked = false
  let telegramUsername: string | null = null

  if (user) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('telegram_accounts')
      .select('telegram_username')
      .eq('supabase_user_id', user.id)
      .single()
    isLinked = !!data
    telegramUsername = data?.telegram_username ?? null
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="12" fill="#2AABEE"/>
              <path d="M17.6 7.2L15.5 17.6c-.2.7-.6.9-1.2.6l-3.3-2.4-1.6 1.5c-.2.2-.3.3-.7.3l.2-3.3 6.1-5.5c.3-.2-.1-.4-.4-.1L7 13.5l-3.2-1c-.7-.2-.7-.7.2-1l13-5c.5-.2 1 .1.8.7z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Telegram Bot</h1>
          <p className="mt-2 text-sm text-white/45">
            Transcribe audio and voice messages directly in Telegram
          </p>
        </div>

        {/* Feature highlights */}
        <div className="mb-8 space-y-3">
          {[
            'Forward a voice message — get transcript instantly',
            'Works with audio from WhatsApp, iMessage, any app',
            'Speaker detection, AI summary, translation on demand',
            'All transcriptions synced to your web history',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2.5 text-sm text-white/55">
              <span className="mt-0.5 text-[#e2ff00]">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Action block */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          {!user ? (
            <div className="text-center">
              <p className="mb-4 text-sm text-white/55">
                Sign in with Google to connect your Telegram account
              </p>
              <Link
                href="/login"
                className="inline-block rounded-lg bg-[#e2ff00] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Sign in with Google
              </Link>
            </div>
          ) : (
            <div>
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-white/40">
                Connect your account
              </p>
              <TelegramLinkButton initialLinked={isLinked} initialUsername={telegramUsername} />
              {!isLinked && (
                <p className="mt-4 text-xs text-white/30">
                  A link will be generated. Open it in Telegram to complete the connection.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-white/25 transition hover:text-white/50">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
