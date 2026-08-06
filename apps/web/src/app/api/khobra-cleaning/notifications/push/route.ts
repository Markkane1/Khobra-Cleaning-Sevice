import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, nativePushConfigured } from '@repo/db'
import { requireAuth } from '@/lib/auth'

const WebSubscriptionSchema = z.object({ endpoint: z.string().url().max(2048), keys: z.object({ p256dh: z.string().min(20), auth: z.string().min(8) }) })
const NativeTokenSchema = z.object({ platform: z.enum(['android', 'ios']), token: z.string().min(20).max(4096) })

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
    native: { android: nativePushConfigured('android'), ios: nativePushConfigured('ios') },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const body = await req.json()
  const native = NativeTokenSchema.safeParse(body)
  if (native.success) {
    await db.nativePushToken.upsert({
      where: { token: native.data.token },
      update: { tenantId: auth.session.tenantId, userId: auth.session.userId, platform: native.data.platform, active: true },
      create: { tenantId: auth.session.tenantId, userId: auth.session.userId, ...native.data },
    })
    return NextResponse.json({ success: true, configured: nativePushConfigured(native.data.platform) })
  }
  const subscription = WebSubscriptionSchema.parse(body)
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { tenantId: auth.session.tenantId, userId: auth.session.userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, active: true },
    create: { tenantId: auth.session.tenantId, userId: auth.session.userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  })
  return NextResponse.json({ success: true, configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const body = await req.json()
  const native = NativeTokenSchema.safeParse(body)
  if (native.success) {
    await db.nativePushToken.updateMany({ where: { token: native.data.token, platform: native.data.platform, tenantId: auth.session.tenantId, userId: auth.session.userId }, data: { active: false } })
    return NextResponse.json({ success: true })
  }
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(body)
  await db.pushSubscription.updateMany({ where: { endpoint, tenantId: auth.session.tenantId, userId: auth.session.userId }, data: { active: false } })
  return NextResponse.json({ success: true })
}
