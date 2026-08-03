import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'

const publicPaths = new Set([
  '/login',
  '/signup',
  '/home',
  '/book',
  '/captcha',
  '/api/khobra-cleaning/auth/login',
  '/api/khobra-cleaning/auth/signup',
  '/api/khobra-cleaning/auth/logout',
  '/api/khobra-cleaning/public/services',
  '/api/khobra-cleaning/public/bookings',
])

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  const session = verifySessionToken(bearer || request.cookies.get('khobra_session')?.value || '')

  if (pathname === '/' && !session) return NextResponse.rewrite(new URL('/home', request.url))

  if (publicPaths.has(pathname)) {
    if (session && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (session) return NextResponse.next()
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
}
