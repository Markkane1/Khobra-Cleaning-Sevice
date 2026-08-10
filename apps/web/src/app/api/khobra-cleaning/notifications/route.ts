import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, deliverPushNotifications } from '@repo/db'
import { CreateNotificationSchema, UpdateNotificationSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const channel = req.nextUrl.searchParams.get('channel')
    const mine = req.nextUrl.searchParams.get('scope') === 'mine'
    const notifications = await db.notification.findMany({
      where: {
        tenantId: auth.session.tenantId,
        ...(channel ? { channel } : {}),
        ...(auth.session.role === 'admin' && !mine ? {} : { OR: [{ userId: auth.session.userId }, { userId: null }] }),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    const shared = notifications.filter(item => !item.userId)
    if (shared.length) await db.notificationReceipt.createMany({ data: shared.map(item => ({ notificationId: item.id, userId: auth.session.userId })), skipDuplicates: true })
    const receipts = shared.length ? await db.notificationReceipt.findMany({ where: { userId: auth.session.userId, notificationId: { in: shared.map(item => item.id) } } }) : []
    const read = new Map(receipts.map(item => [item.notificationId, Boolean(item.readAt)]))
    return NextResponse.json(notifications.map(item => ({ ...item, read: item.userId ? item.read : read.get(item.id) || false })))
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch notifications' })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const data = UpdateNotificationSchema.parse(await req.json())
    const channel = req.nextUrl.searchParams.get('channel')
    const mine = req.nextUrl.searchParams.get('scope') === 'mine'
    const where = {
      tenantId: auth.session.tenantId,
      ...(channel ? { channel } : {}),
      ...(auth.session.role === 'admin' && !mine ? {} : { OR: [{ userId: auth.session.userId }, { userId: null }] }),
    }
    if (data.markAllRead) {
      const shared = await db.notification.findMany({ where: { ...where, userId: null }, select: { id: true } })
      if (shared.length) await Promise.all(shared.map(item => db.notificationReceipt.upsert({ where: { notificationId_userId: { notificationId: item.id, userId: auth.session.userId } }, update: { readAt: new Date() }, create: { notificationId: item.id, userId: auth.session.userId, readAt: new Date() } })))
      await db.notification.updateMany({ where: { ...where, userId: { not: null } }, data: { read: true } })
      return NextResponse.json({ success: true })
    }
    if (!data.id) return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    const notification = await db.notification.findFirst({ where: { ...where, id: data.id } })
    if (!notification) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    if (notification.userId) await db.notification.update({ where: { id: notification.id }, data: { read: true } })
    else await db.notificationReceipt.upsert({ where: { notificationId_userId: { notificationId: notification.id, userId: auth.session.userId } }, update: { readAt: new Date() }, create: { notificationId: notification.id, userId: auth.session.userId, readAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to update notification', missing: 'Notification not found', domainErrorStatus: 400 })
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
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to create notification', missing: 'Active recipient not found', domainErrorStatus: 400 })
  }
}
