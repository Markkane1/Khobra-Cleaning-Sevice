import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@repo/db'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!('response' in auth)) await db.user.update({ where: { id: auth.session.userId }, data: { sessionVersion: { increment: 1 } } })
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
