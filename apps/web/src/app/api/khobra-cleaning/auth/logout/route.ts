import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@repo/db'
import { broadcast } from '@/lib/broadcast'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!('response' in auth)) {
    await db.$transaction([
      db.user.update({ where: { id: auth.session.userId }, data: { sessionVersion: { increment: 1 } } }),
      db.pushSubscription.updateMany({ where: { userId: auth.session.userId }, data: { active: false } }),
      db.nativePushToken.updateMany({ where: { userId: auth.session.userId }, data: { active: false } }),
    ])
    broadcast('session:revoked', {}, auth.session.tenantId, auth.session.userId)
  }
  const response = NextResponse.json({ success: true, message: 'Logged out' })
  response.cookies.set('khobra_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
