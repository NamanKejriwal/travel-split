import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Use NextUrl to parse the request URL. This handles proxied headers automatically.
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Construct the redirect URL using the request's origin.
      // This ensures we redirect to the exact same domain the browser is currently on,
      // which is critical for the cookie to be accepted immediately.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${requestUrl.origin}${next}`)
      } else if (forwardedHost) {
        // In production (Vercel/etc), always force HTTPS and use the forwarded host
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${requestUrl.origin}${next}`)
      }
    }
  }

  // If there's an error or no code, redirect to error page on the same origin
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
}