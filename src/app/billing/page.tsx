import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'

interface Package {
  id: 'ensayo' | 'creador' | 'pro'
  name: string
  priceUsd: number
  hours: number
  popular?: boolean
}

const PACKAGES: Package[] = [
  { id: 'ensayo', name: 'Starter', priceUsd: 5, hours: 10 },
  { id: 'creador', name: 'Creator', priceUsd: 10, hours: 30, popular: true },
  { id: 'pro', name: 'Pro', priceUsd: 20, hours: 80 },
]

function formatCredits(secs: number): string {
  const hours = Math.floor(secs / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${mins} min`
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

  return (
    <>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        <Link href="/" className="text-sm font-semibold text-white hover:text-white/80 transition">
          Transcribe
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/history" className="text-sm text-white/50 hover:text-white transition">
            History
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          {/* Current balance */}
          <div className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Your balance
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

          {/* Packages */}
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-white">Buy credits</h1>
            <p className="mt-1 text-sm text-white/45">
              Pay once. Credits never expire.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={[
                  'relative flex flex-col rounded-2xl border p-6 transition',
                  pkg.popular
                    ? 'border-[#e2ff00]/40 bg-[#e2ff00]/[0.03]'
                    : 'border-white/[0.08] bg-white/[0.02]',
                ].join(' ')}
              >
                {pkg.popular && (
                  <span className="absolute -top-2.5 left-6 rounded-full bg-[#e2ff00] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                    Popular
                  </span>
                )}

                <h2 className="text-lg font-semibold text-white">{pkg.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">
                    ${pkg.priceUsd}
                  </span>
                  <span className="text-sm text-white/40">USD</span>
                </div>
                <p className="mt-1 text-sm text-white/60">
                  {pkg.hours} hours of transcription
                </p>

                <ul className="mt-5 space-y-2 text-sm text-white/60">
                  <li className="flex gap-2">
                    <span className="text-[#e2ff00]">✓</span>
                    <span>Never expires</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#e2ff00]">✓</span>
                    <span>Speaker diarization</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#e2ff00]">✓</span>
                    <span>AI summary</span>
                  </li>
                </ul>

                <button
                  disabled
                  title="Coming soon"
                  className={[
                    'mt-6 w-full rounded-xl py-3 text-sm font-semibold transition',
                    'cursor-not-allowed opacity-50',
                    pkg.popular
                      ? 'bg-[#e2ff00] text-black'
                      : 'border border-white/15 text-white/70',
                  ].join(' ')}
                >
                  Buy
                </button>

                <p className="mt-2 text-center text-[11px] text-white/30">
                  Coming soon
                </p>
              </div>
            ))}
          </div>

          {/* Payment methods preview */}
          <div className="mt-10 rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Payment methods
            </p>
            <p className="mt-2 text-sm text-white/60">
              Payment integration coming soon
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
