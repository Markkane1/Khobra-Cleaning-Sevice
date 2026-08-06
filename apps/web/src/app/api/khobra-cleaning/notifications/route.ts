import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, deliverPushNotifications } from '@repo/db'
import { CreateNotificationSchema, UpdateNotificationSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const channel = req.nextUrl.searchParams.get('channel')
    const notifications = await db.notification.findMany({
      where: {
        tenantId: auth.session.tenantId,
        ...(channel ? { channel } : {}),
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
    const channel = req.nextUrl.searchParams.get('channel')
    const where = {
      tenantId: auth.session.tenantId,
      ...(channel ? { channel } : {}),
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
    const recipients = await db.user.findMany({
      where: {
        tenantId: auth.session.tenantId,
        status: 'active',
        ...(data.userId ? { id: data.userId } : {}),
      },
      select: { id: true },
    })
    if (!recipients.length) return NextResponse.json({ error: data.userId ? 'Active recipient not found' : 'No active recipients found' }, { status: 404 })

    const deliveryKey = `manual:${randomUUID()}`
    const notices = recipients.map(({ id: userId }) => ({
      tenantId: auth.session.tenantId,
      userId,
      deliveryKey,
      title: data.title,
      message: data.message,
      type: data.type,
    }))
    await db.notification.createMany({
      data: notices.map(notice => ({ ...notice, channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() })),
    })
    await deliverPushNotifications(db, notices)
    return NextResponse.json({ success: true, recipients: recipients.length }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create notification' }, { status: 400 })
  }
}
