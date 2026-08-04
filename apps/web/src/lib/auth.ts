import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, type RoleId, type VerifiedSession } from './auth-crypto'
import { db } from '@repo/db'

export * from './auth-crypto'

export async function getAuthSession(req: NextRequest): Promise<VerifiedSession | null> {
  let session: VerifiedSession | null = null
  // 1. Check Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    session = verifySessionToken(token)
  }

  // 2. Check Cookie
  if (!session) {
    const cookie = req.cookies.get('khobra_session')?.value
    if (cookie) session = verifySessionToken(cookie)
  }
  if (!session) return null
  const user = await db.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId, status: 'active' },
    select: { email: true, name: true, role: true, sessionVersion: true },
  })
  if (!user || user.email !== session.email || user.role !== session.role || user.sessionVersion !== (session.sessionVersion ?? 0)) return null
  return { ...session, name: user.name }
}

export async function requireAuth(
  req: NextRequest,
  allowedRoles?: RoleId[],
): Promise<{ session: VerifiedSession } | { response: NextResponse }> {
  const session = await getAuthSession(req)
  if (!session) {
    return {
      response: NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 }),
    }
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.headers.get('authorization')) {
    const origin = req.headers.get('origin')
    const forwardedHost = req.headers.get('x-forwarded-host')
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
    const allowed = new Set([new URL(req.url).origin, process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined].filter(Boolean))
    if (!origin || !allowed.has(origin)) return { response: NextResponse.json({ error: 'Forbidden request origin.' }, { status: 403 }) }
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      response: NextResponse.json({ error: `Forbidden. Role '${session.role}' is not allowed.` }, { status: 403 }),
    }
  }

  return { session }
}
