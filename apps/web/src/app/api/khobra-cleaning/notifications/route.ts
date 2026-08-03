import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { CreateNotificationSchema, UpdateNotificationSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const notifications = await db.notification.findMany({
      where: {
        tenantId: auth.session.tenantId,
        ...(auth.session.role === 'admin' ? {} : { OR: [{ userId: auth.session.userId }, { userId: null }] }),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json(notifications)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const data = UpdateNotificationSchema.parse(await req.json())
    const where = {
      tenantId: auth.session.tenantId,
      ...(auth.session.role === 'admin' ? {} : { userId: auth.session.userId }),
    }
    if (data.markAllRead) {
      await db.notification.updateMany({ where, data: { read: true } })
      return NextResponse.json({ success: true })
    }
    if (!data.id) return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    const updated = await db.notification.updateMany({ where: { ...where, id: data.id }, data: { read: true } })
    if (!updated.count) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update notification' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const data = CreateNotificationSchema.parse(await req.json())
    return NextResponse.json(await db.notification.create({ data: { ...data, tenantId: auth.session.tenantId } }), { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create notification' }, { status: 400 })
  }
}
