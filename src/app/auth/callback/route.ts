import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Do not trust x-forwarded-host. A client can send it, and the redirect
  // would leave the site. NEXT_PUBLIC_APP_URL is the address of this deploy.
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const base = configured || origin

  return NextResponse.redirect(`${base}/`)
}
