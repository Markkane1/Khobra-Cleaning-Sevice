import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, type RoleId, type VerifiedSession } from './auth-crypto'

export * from './auth-crypto'

export async function getAuthSession(req: NextRequest): Promise<VerifiedSession | null> {
  // 1. Check Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const session = verifySessionToken(token)
    if (session) return session
  }

  // 2. Check Cookie
  const cookie = req.cookies.get('khobra_session')?.value
  if (cookie) {
    const session = verifySessionToken(cookie)
    if (session) return session
  }

  return null
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

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      response: NextResponse.json({ error: `Forbidden. Role '${session.role}' is not allowed.` }, { status: 403 }),
    }
  }

  return { session }
}
