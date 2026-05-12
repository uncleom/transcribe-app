import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Behind a reverse proxy (Traefik/nginx), request.url contains the internal
  // address (e.g. localhost:3000). Use x-forwarded-host when available.
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : origin

  return NextResponse.redirect(`${base}/`)
}
