import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

const BOT_USERNAME = 'TranscriboAppBot'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check if already linked
  const { data: existing } = await admin
    .from('telegram_accounts')
    .select('telegram_id, telegram_username')
    .eq('supabase_user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({
      already_linked: true,
      telegram_username: existing.telegram_username,
    })
  }

  // Generate one-time token (TTL: 15 min)
  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await admin.from('telegram_link_tokens').insert({
    token,
    supabase_user_id: user.id,
    expires_at: expiresAt,
  })

  return NextResponse.json({
    deep_link: `https://t.me/${BOT_USERNAME}?start=link_${token}`,
  })
}

export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('telegram_accounts').delete().eq('supabase_user_id', user.id)

  return NextResponse.json({ ok: true })
}
