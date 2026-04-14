import { createAdminClient } from '@/lib/supabase/server'

export type CreditSubject =
  | { type: 'user'; id: string }
  | { type: 'anon'; ip: string }

const ANON_LIMIT_SECONDS = 180

/**
 * Returns remaining seconds and whether the given duration fits.
 * For is_unlimited users, sufficient is always true.
 */
export async function checkCredits(
  subject: CreditSubject,
  durationSeconds: number
): Promise<{ sufficient: boolean; remaining: number; limit: number }> {
  const admin = createAdminClient()

  if (subject.type === 'user') {
    const { data } = await admin
      .from('profiles')
      .select('credits_seconds, is_unlimited')
      .eq('id', subject.id)
      .single()

    if (!data) return { sufficient: false, remaining: 0, limit: 0 }
    if (data.is_unlimited) return { sufficient: true, remaining: Infinity, limit: Infinity }

    return {
      sufficient: data.credits_seconds >= durationSeconds,
      remaining: data.credits_seconds,
      limit: data.credits_seconds,
    }
  }

  // anon
  const { data } = await admin
    .from('anonymous_usage')
    .select('used_seconds')
    .eq('ip', subject.ip)
    .maybeSingle()

  const used = data?.used_seconds ?? 0
  const remaining = Math.max(0, ANON_LIMIT_SECONDS - used)
  return {
    sufficient: remaining >= durationSeconds,
    remaining,
    limit: ANON_LIMIT_SECONDS,
  }
}

/**
 * Atomically reserve seconds. Throws CreditsInsufficientError if balance is too low.
 */
export class CreditsInsufficientError extends Error {
  constructor() { super('Insufficient credits') }
}

export async function reserveCredits(
  subject: CreditSubject,
  seconds: number
): Promise<void> {
  const admin = createAdminClient()

  if (subject.type === 'user') {
    const { data, error } = await admin.rpc('reserve_user_credits', {
      p_user_id: subject.id,
      p_seconds: seconds,
    })
    if (error) throw error
    if (!data) throw new CreditsInsufficientError()
    return
  }

  // anon
  const { data, error } = await admin.rpc('reserve_anon_credits', {
    p_ip: subject.ip,
    p_seconds: seconds,
  })
  if (error) throw error
  if (!data) throw new CreditsInsufficientError()
}

/**
 * Adjust balance after completion: refund (reserved - actual) if positive,
 * charge extra if negative. is_unlimited users are skipped.
 */
export async function adjustCredits(
  subject: CreditSubject,
  reserved: number,
  actual: number
): Promise<void> {
  const admin = createAdminClient()

  if (subject.type === 'user') {
    await admin.rpc('adjust_user_credits', {
      p_user_id: subject.id,
      p_reserved: reserved,
      p_actual: actual,
    })
    return
  }

  await admin.rpc('adjust_anon_credits', {
    p_ip: subject.ip,
    p_reserved: reserved,
    p_actual: actual,
  })
}

/**
 * Full refund — called when transcription job errors out.
 */
export async function refundCredits(
  subject: CreditSubject,
  reserved: number
): Promise<void> {
  const admin = createAdminClient()

  if (subject.type === 'user') {
    await admin.rpc('refund_user_credits', {
      p_user_id: subject.id,
      p_reserved: reserved,
    })
    return
  }

  await admin.rpc('refund_anon_credits', {
    p_ip: subject.ip,
    p_reserved: reserved,
  })
}

/** Extract client IP from request headers. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
