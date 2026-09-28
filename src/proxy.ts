import { createServerClient } from '@supabase/ssr'
import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const handleI18nRouting = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  // Locale negotiation + redirects first; then refresh Supabase session on that response.
  const response = handleI18nRouting(request)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session — must not use getUser() result for auth decisions here
  await supabase.auth.getUser()

  return response
}

export const config = {
  // Language routing must NOT touch /api/* (large uploads buffer in proxy;
  // webhooks/auth APIs stay out too), nor Supabase auth callbacks, _next, static.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
}
