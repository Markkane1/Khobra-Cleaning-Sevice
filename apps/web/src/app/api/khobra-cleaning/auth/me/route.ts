import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, requireAuth } from '@/lib/auth'
import { db } from '@repo/db'
import { UpdateOwnProfileSchema } from '@repo/core'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req)
  if (!session) {
    return NextResponse.json({ authenticated: false })
  }
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true, phone: true, avatarUrl: true } })
  return NextResponse.json({ authenticated: true, user: { ...session, ...user, avatarUrl: user?.avatarUrl || null } })
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const session = auth.session
    const data = UpdateOwnProfileSchema.parse(await req.json())

    if (data.avatarUrl) {
      const asset = await db.uploadAsset.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, url: data.avatarUrl, purpose: 'profile-photos', mimeType: { startsWith: 'image/' } } })
      if (!asset) return NextResponse.json({ error: 'Use a profile photo uploaded by this account.' }, { status: 400 })
    }

    const user = await db.user.update({ where: { id: session.userId }, data, select: { name: true, email: true, phone: true, avatarUrl: true } })
    return NextResponse.json({ user })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Could not update profile' })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer'])
    if ('response' in auth) return auth.response
    const user = await db.user.findUniqueOrThrow({ where: { id: auth.session.userId }, include: { customer: true } })
    const deletedEmail = `deleted-${user.id}@deleted.invalid`
    await db.$transaction([
      db.accountDeletionRequest.create({ data: { tenantId: user.tenantId, userId: user.id, email: user.email, status: 'completed', retainedDataReason: 'Completed bookings, invoices, payments, and audit records are retained in anonymized form.', completedAt: new Date() } }),
      db.pushSubscription.deleteMany({ where: { userId: user.id } }),
      db.nativePushToken.deleteMany({ where: { userId: user.id } }),
      db.uploadAsset.deleteMany({ where: { userId: user.id } }),
      ...(user.customer ? [db.customer.update({ where: { id: user.customer.id }, data: { phone: null, altPhone: null, address: null, addresses: [], city: null, area: null, notes: null, preferences: null, status: 'deleted', deletedAt: new Date() } })] : []),
      db.user.update({ where: { id: user.id }, data: { email: deletedEmail, name: 'Deleted customer', phone: null, avatarUrl: null, passwordHash: null, status: 'deleted', sessionVersion: { increment: 1 } } }),
    ])
    const response = NextResponse.json({ success: true, message: 'Your account has been deleted. Retained operational records have been anonymized.' })
    response.cookies.set('khobra_session', '', { httpOnly: true, path: '/', maxAge: 0 })
    return response
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Could not delete account' })
  }
}
