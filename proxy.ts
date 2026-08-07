/**
 * Next.js Proxy (formerly Middleware — renamed in Next.js 16).
 *
 * Runs on the Node.js runtime before every matched request.
 *
 * Current responsibilities:
 *   - Pass-through (auth guards and locale detection will be added here)
 *
 * Future additions:
 *   - Auth.js session verification for /dashboard routes
 *   - Internationalisation locale detection
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Auth guards will be wired here once Auth.js is configured.
  // e.g.: if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
  //         return NextResponse.redirect(new URL('/sign-in', request.url))
  //       }
  return NextResponse.next()
}

export const config = {
  /*
   * Match all request paths EXCEPT:
   *   - _next/static  (static files)
   *   - _next/image   (image optimisation)
   *   - _next/data    (RSC data routes — always need to match the page)
   *   - favicon.ico, sitemap.xml, robots.txt
   *   - Static asset extensions
   */
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
