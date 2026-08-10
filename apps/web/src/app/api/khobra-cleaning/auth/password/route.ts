import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { hashPassword, requireAuth, verifyPassword } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { ChangePasswordSchema } from '@repo/core'
import { apiErrorResponse } from '@/lib/api-error'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if ('response' in auth) return auth.response
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(await request.json())

    const user = await db.user.findUnique({ where: { id: auth.session.userId } })
    if (!user?.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
    }

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } } }),
      db.pushSubscription.updateMany({ where: { userId: user.id }, data: { active: false } }),
      db.nativePushToken.updateMany({ where: { userId: user.id }, data: { active: false } }),
    ])
    broadcast('session:revoked', {}, auth.session.tenantId, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Could not change password' })
  }
}
