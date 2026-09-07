import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const authToken = request.cookies.get('fello_auth_token')
  const waitlistToken = request.cookies.get('waitlist_domain')
  const { pathname } = request.nextUrl

  // Fully authenticated users: redirect away from sign-in and waitlist
  if (authToken) {
    if (pathname === '/sign-in' || pathname === '/waitlist') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Waitlisted users: the short-lived cookie grants access to /waitlist only
  // (cookie is set during the sign-in flow — no public URL access without it)
  if (pathname === '/waitlist') {
    return waitlistToken
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Sign-in page is always public
  if (pathname === '/sign-in') {
    return NextResponse.next()
  }

  // Everything else requires full auth
  return NextResponse.redirect(new URL('/sign-in', request.url))
}

// Config ensures middleware only runs on necessary paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.webp|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.ico).*)'],
}
