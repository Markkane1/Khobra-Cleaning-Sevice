import type { PrismaClient } from '@prisma/client'
import webpush from 'web-push'

type PushNotice = { tenantId: string; userId: string; statusHistoryId: string; title: string; message: string; type: string }

export async function deliverWebPush(db: PrismaClient, notices: PushNotice[]) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey || !notices.length) return
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@khobracleaning.com', publicKey, privateKey)
  await db.notification.createMany({ skipDuplicates: true, data: notices.map(notice => ({ ...notice, channel: 'web_push', deliveryStatus: 'pending' })) })
  const subscriptions = await db.pushSubscription.findMany({ where: { tenantId: notices[0]!.tenantId, userId: { in: notices.map(notice => notice.userId) }, active: true } })
  for (const notice of notices) {
    const notification = await db.notification.findFirst({ where: { statusHistoryId: notice.statusHistoryId, userId: notice.userId, channel: 'web_push' } })
    if (!notification) continue
    const targets = subscriptions.filter(subscription => subscription.userId === notice.userId)
    if (!targets.length) {
      await db.notification.update({ where: { id: notification.id }, data: { deliveryStatus: 'skipped', deliveryAttemptedAt: new Date(), deliveryError: 'No active push subscription' } })
      continue
    }
    const results = await Promise.allSettled(targets.map(subscription => webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: notice.title, body: notice.message, url: '/bookings' }))))
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [{ result, target: targets[index]! }] : [])
    await db.notification.update({ where: { id: notification.id }, data: { deliveryStatus: failures.length === results.length ? 'failed' : 'sent', deliveryAttemptedAt: new Date(), deliveryError: failures.length ? failures.map(({ result }) => String(result.reason?.message || result.reason)).join('; ').slice(0, 1000) : null } })
    await Promise.all(failures.map(({ result, target }) => [404, 410].includes(result.reason?.statusCode) ? db.pushSubscription.update({ where: { id: target.id }, data: { active: false } }) : Promise.resolve()))
  }
}
