import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { hashPassword, requireAuth, verifyPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('response' in auth) return auth.response

  const { currentPassword, newPassword } = await request.json()
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'Current password and an 8-character new password are required.' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: auth.session.userId } })
  if (!user?.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } } }),
    db.pushSubscription.updateMany({ where: { userId: user.id }, data: { active: false } }),
    db.nativePushToken.updateMany({ where: { userId: user.id }, data: { active: false } }),
  ])
  return NextResponse.json({ success: true })
}
