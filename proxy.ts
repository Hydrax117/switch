/**
 * Next.js Proxy (formerly Middleware — renamed in Next.js 16).
 *
 * Responsibilities:
 *   - Redirect unauthenticated users away from /dashboard routes to /sign-in
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Paths that require authentication */
const PROTECTED = ['/dashboard', '/profile']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))

  if (isProtected) {
    // Check for the Auth.js session token cookie (JWT strategy)
    const sessionToken =
      request.cookies.get('authjs.session-token') ??
      request.cookies.get('__Secure-authjs.session-token')

    if (!sessionToken) {
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|sitemap.xml|robots.txt|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
