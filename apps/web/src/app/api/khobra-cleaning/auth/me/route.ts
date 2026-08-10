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
