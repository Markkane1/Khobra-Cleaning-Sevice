import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'

const SubscriptionSchema = z.object({ endpoint: z.string().url().max(2048), keys: z.object({ p256dh: z.string().min(20), auth: z.string().min(8) }) })

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  return NextResponse.json({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const subscription = SubscriptionSchema.parse(await req.json())
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { tenantId: auth.session.tenantId, userId: auth.session.userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, active: true },
    create: { tenantId: auth.session.tenantId, userId: auth.session.userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await req.json())
  await db.pushSubscription.updateMany({ where: { endpoint, tenantId: auth.session.tenantId, userId: auth.session.userId }, data: { active: false } })
  return NextResponse.json({ success: true })
}
