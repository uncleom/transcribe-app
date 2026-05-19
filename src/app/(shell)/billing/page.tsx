import { redirect } from 'next/navigation'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import TelegramLinkButton from '@/components/TelegramLinkButton'
import LogoutButton from '@/components/LogoutButton'

function formatCredits(secs: number): string {
  if (secs <= 0) return '0 min'
  const hours = Math.floor(secs / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (hours === 0 && mins === 0) return `${s} sec`
  if (hours === 0) return mins > 0 && s > 0 ? `${mins} min ${s} sec` : `${mins} min`
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`
}

export default async function BillingPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_seconds, is_unlimited')
    .eq('id', user.id)
    .single()

  const currentCredits = profile?.credits_seconds ?? 0
  const isUnlimited = profile?.is_unlimited ?? false

  const admin = createAdminClient()
  const { data: telegramAccount } = await admin
    .from('telegram_accounts')
    .select('telegram_username')
    .eq('supabase_user_id', user.id)
    .single()
  const isTelegramLinked = !!telegramAccount

  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-xl font-semibold text-white">Account</h1>

        {/* Current balance */}
        <div className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            Credits remaining
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {isUnlimited ? '∞' : formatCredits(currentCredits)}
          </p>
          {!isUnlimited && (
            <p className="mt-1 text-sm text-white/45">
              available for transcription
            </p>
          )}
        </div>

        {/* Coming soon */}
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
          <p className="text-lg font-semibold text-white">Top up credits</p>
          <p className="mt-2 text-sm text-white/45">
            Pay-as-you-go packages starting at $5 · Credits never expire
          </p>
          <p className="mt-6 inline-block rounded-full border border-white/10 px-4 py-1.5 text-xs text-white/35">
            Payment integration coming soon
          </p>
        </div>

        {/* Telegram */}
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Telegram Bot</p>
              <p className="mt-1 text-xs text-white/40">
                Forward voice messages or audio — get transcripts in Telegram
              </p>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <circle cx="12" cy="12" r="12" fill="#2AABEE"/>
              <path d="M17.6 7.2L15.5 17.6c-.2.7-.6.9-1.2.6l-3.3-2.4-1.6 1.5c-.2.2-.3.3-.7.3l.2-3.3 6.1-5.5c.3-.2-.1-.4-.4-.1L7 13.5l-3.2-1c-.7-.2-.7-.7.2-1l13-5c.5-.2 1 .1.8.7z" fill="white"/>
            </svg>
          </div>
          <div className="mt-4">
            <TelegramLinkButton
              initialLinked={isTelegramLinked}
              initialUsername={telegramAccount?.telegram_username ?? null}
            />
          </div>
        </div>
        {/* Sign out */}
        <div className="mt-2 flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </main>
  )
}
