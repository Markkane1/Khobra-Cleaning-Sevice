import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'

const publicPaths = new Set([
  '/login',
  '/signup',
  '/home',
  '/book',
  '/about',
  '/privacy-policy',
  '/captcha',
  '/api/khobra-cleaning/auth/login',
  '/api/khobra-cleaning/auth/signup',
  '/api/khobra-cleaning/auth/logout',
  '/api/khobra-cleaning/auth/me',
  '/api/khobra-cleaning/public/services',
  '/api/khobra-cleaning/public/bookings',
  '/api/health',
])

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestId = crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)
  const finish = (response: NextResponse) => {
    response.headers.set('x-request-id', requestId)
    return response
  }
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  const session = verifySessionToken(bearer || request.cookies.get('khobra_session')?.value || '')

  if (pathname === '/' && !session) return finish(NextResponse.rewrite(new URL('/home', request.url), { request: { headers: requestHeaders } }))

  if (publicPaths.has(pathname)) {
    if (session && (pathname === '/login' || pathname === '/signup')) {
      return finish(NextResponse.redirect(new URL('/', request.url)))
    }
    return finish(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  if (session) return finish(NextResponse.next({ request: { headers: requestHeaders } }))
  if (pathname.startsWith('/api/')) {
    return finish(NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 }))
  }
  return finish(NextResponse.redirect(new URL('/login', request.url)))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
}
