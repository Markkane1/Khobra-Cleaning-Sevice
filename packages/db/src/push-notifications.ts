import { createSign } from 'node:crypto'
import { connect } from 'node:http2'
import type { PrismaClient } from '@prisma/client'
import webpush from 'web-push'

export type PushNotice = {
  tenantId: string
  userId: string
  deliveryKey: string
  statusHistoryId?: string
  pickupAlertId?: string
  title: string
  message: string
  type: string
}

type NativePlatform = 'android' | 'ios'
type DeliveryResult = { ok: boolean; permanent?: boolean; error?: string }

const privateKey = (value = '') => value.replace(/\\n/g, '\n')
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const content = (notice: PushNotice) => ({ title: notice.title.slice(0, 120), body: notice.message.slice(0, 700) })
const destination = (notice: PushNotice) => ['booking_status', 'pickup_alert_high'].includes(notice.type) ? '/bookings' : '/notifications'

export const isPermanentFcmFailure = (status: number, body: string) => status === 404 || /UNREGISTERED/.test(body)
export const isPermanentApnsFailure = (status: number, body: string) => status === 410 || /BadDeviceToken|DeviceTokenNotForTopic|Unregistered/.test(body)

export function nativePushConfigured(platform: NativePlatform) {
  return platform === 'android'
    ? Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
    : Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY && process.env.APNS_BUNDLE_ID)
}

async function fcmAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = encoded({ alg: 'RS256', typ: 'JWT' })
  const claims = encoded({
    iss: process.env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(privateKey(process.env.FIREBASE_PRIVATE_KEY), 'base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = await response.json() as { access_token?: string; error_description?: string }
  if (!response.ok || !body.access_token) throw new Error(body.error_description || `FCM authorization failed (${response.status})`)
  return body.access_token
}

async function sendFcm(token: string, notice: PushNotice, accessToken: string): Promise<DeliveryResult> {
  const notification = content(notice)
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token,
      notification,
      data: { url: destination(notice), type: notice.type },
      android: { priority: 'high', notification: { channel_id: 'khobra_updates', sound: 'default' } },
    } }),
    signal: AbortSignal.timeout(10_000),
  })
  if (response.ok) return { ok: true }
  const error = await response.text()
  return { ok: false, permanent: isPermanentFcmFailure(response.status, error), error: error.slice(0, 1000) }
}

function apnsJwt() {
  const header = encoded({ alg: 'ES256', kid: process.env.APNS_KEY_ID })
  const claims = encoded({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })
  const signature = createSign('SHA256').update(`${header}.${claims}`).sign({ key: privateKey(process.env.APNS_PRIVATE_KEY), dsaEncoding: 'ieee-p1363' }, 'base64url')
  return `${header}.${claims}.${signature}`
}

async function sendApns(token: string, notice: PushNotice): Promise<DeliveryResult> {
  const authority = process.env.APNS_PRODUCTION === 'false' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
  const notification = content(notice)
  return new Promise(resolve => {
    const client = connect(authority)
    let settled = false
    const finish = (result: DeliveryResult) => {
      if (settled) return
      settled = true
      client.destroy()
      resolve(result)
    }
    client.setTimeout(10_000, () => finish({ ok: false, error: 'APNs delivery timed out' }))
    client.once('error', error => finish({ ok: false, error: error.message }))
    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${encodeURIComponent(token)}`,
      authorization: `bearer ${apnsJwt()}`,
      'apns-topic': process.env.APNS_BUNDLE_ID!,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })
    let body = ''
    let status = 0
    request.setEncoding('utf8')
    request.on('response', headers => { status = Number(headers[':status'] || 0) })
    request.on('data', chunk => { body += chunk })
    request.on('end', () => finish(status === 200
      ? { ok: true }
      : { ok: false, permanent: isPermanentApnsFailure(status, body), error: body || `APNs delivery failed (${status})` }))
    request.once('error', error => finish({ ok: false, error: error.message }))
    request.end(JSON.stringify({ aps: { alert: notification, sound: 'default' }, url: destination(notice), type: notice.type }))
  })
}

const noticeWhere = (notice: PushNotice, channel: string) => ({
  deliveryKey: notice.deliveryKey,
  userId: notice.userId,
  channel,
})

async function deliverWebPush(db: PrismaClient, notices: PushNotice[]) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  await db.notification.createMany({ skipDuplicates: true, data: notices.map(notice => ({ ...notice, channel: 'web_push', deliveryStatus: 'pending' })) })
  if (!publicKey || !vapidPrivateKey) {
    await Promise.all(notices.map(notice => db.notification.updateMany({ where: noticeWhere(notice, 'web_push'), data: { deliveryStatus: 'skipped', deliveryAttemptedAt: new Date(), deliveryError: 'Web push is not configured' } })))
    return
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@khobracleaning.com', publicKey, vapidPrivateKey)
  const subscriptions = await db.pushSubscription.findMany({ where: { tenantId: notices[0]!.tenantId, userId: { in: notices.map(notice => notice.userId) }, active: true } })
  for (const notice of notices) {
    const targets = subscriptions.filter(subscription => subscription.userId === notice.userId)
    if (!targets.length) {
      await db.notification.updateMany({ where: noticeWhere(notice, 'web_push'), data: { deliveryStatus: 'skipped', deliveryAttemptedAt: new Date(), deliveryError: 'No active web push subscription' } })
      continue
    }
    const results = await Promise.allSettled(targets.map(subscription => webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ ...content(notice), url: destination(notice) }))))
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [{ result, target: targets[index]! }] : [])
    await db.notification.updateMany({ where: noticeWhere(notice, 'web_push'), data: { deliveryStatus: failures.length === results.length ? 'failed' : 'sent', deliveryAttemptedAt: new Date(), deliveryError: failures.length ? failures.map(({ result }) => String(result.reason?.message || result.reason)).join('; ').slice(0, 1000) : null } })
    await Promise.all(failures.map(({ result, target }) => [404, 410].includes(result.reason?.statusCode) ? db.pushSubscription.update({ where: { id: target.id }, data: { active: false } }) : Promise.resolve()))
  }
}

async function deliverNativePush(db: PrismaClient, notices: PushNotice[]) {
  await db.notification.createMany({ skipDuplicates: true, data: notices.map(notice => ({ ...notice, channel: 'native_push', deliveryStatus: 'pending' })) })
  const tokens = await db.nativePushToken.findMany({ where: { tenantId: notices[0]!.tenantId, userId: { in: notices.map(notice => notice.userId) }, active: true } })
  let accessToken: string | null = null
  let fcmError: string | null = null
  if (tokens.some(token => token.platform === 'android') && nativePushConfigured('android')) {
    try { accessToken = await fcmAccessToken() } catch (error) { fcmError = error instanceof Error ? error.message : String(error) }
  }
  for (const notice of notices) {
    const targets = tokens.filter(token => token.userId === notice.userId)
    if (!targets.length) {
      await db.notification.updateMany({ where: noticeWhere(notice, 'native_push'), data: { deliveryStatus: 'skipped', deliveryAttemptedAt: new Date(), deliveryError: 'No active native push token' } })
      continue
    }
    const results = await Promise.all(targets.map(async target => {
      try {
        if (target.platform === 'android') {
          if (!nativePushConfigured('android')) return { ok: false, error: 'Android push is not configured' }
          if (!accessToken) return { ok: false, error: fcmError || 'FCM authorization failed' }
          return await sendFcm(target.token, notice, accessToken)
        }
        if (target.platform === 'ios') {
          if (!nativePushConfigured('ios')) return { ok: false, error: 'iOS push is not configured' }
          return await sendApns(target.token, notice)
        }
        return { ok: false, permanent: true, error: `Unsupported native push platform: ${target.platform}` }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }))
    await Promise.all(results.map((result, index) => result.permanent ? db.nativePushToken.update({ where: { id: targets[index]!.id }, data: { active: false } }) : Promise.resolve()))
    const failures = results.filter(result => !result.ok)
    await db.notification.updateMany({ where: noticeWhere(notice, 'native_push'), data: {
      deliveryStatus: failures.length === results.length ? (failures.every(result => /not configured/.test(result.error || '')) ? 'skipped' : 'failed') : 'sent',
      deliveryAttemptedAt: new Date(),
      deliveryError: failures.length ? failures.map(result => result.error).filter(Boolean).join('; ').slice(0, 1000) : null,
    } })
  }
}

export async function deliverPushNotifications(db: PrismaClient, notices: PushNotice[]) {
  if (!notices.length) return
  const results = await Promise.allSettled([deliverWebPush(db, notices), deliverNativePush(db, notices)])
  results.forEach(result => {
    if (result.status === 'rejected') console.error('Push notification channel delivery failed', result.reason)
  })
}
