import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkCredits, getClientIp } from '@/lib/credits'

export async function GET(req: NextRequest) {
  const durationParam = req.nextUrl.searchParams.get('duration')
  const duration = durationParam ? Math.max(0, parseInt(durationParam, 10)) : 0

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const result = await checkCredits({ type: 'user', id: user.id }, duration)
    return NextResponse.json({
      is_unlimited: result.remaining === Infinity,
      remaining_seconds: result.remaining === Infinity ? null : result.remaining,
      limit_seconds: null,
      sufficient: result.sufficient,
    })
  }

  // anonymous
  const ip = getClientIp(req)
  const result = await checkCredits({ type: 'anon', ip }, duration)
  return NextResponse.json({
    is_unlimited: false,
    remaining_seconds: result.remaining,
    limit_seconds: result.limit,
    sufficient: result.sufficient,
  })
}
